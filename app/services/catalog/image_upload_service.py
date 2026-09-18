"""Process product images and store them in Cloudinary or local development storage."""
import io
import uuid
from pathlib import Path
from urllib.parse import urlparse

import cloudinary
import cloudinary.uploader
from flask import current_app
from PIL import Image

from app import db
from app.models.catalog.product_image import ProductImage
from app.services.exceptions import ResourceNotFoundError, StorageError, ValidationError

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _target_dims() -> tuple[int, int]:
    w = current_app.config.get("PRODUCT_IMAGE_WIDTH", 800)
    h = current_app.config.get("PRODUCT_IMAGE_HEIGHT", 800)
    return int(w), int(h)


def _upload_dir() -> Path:
    folder = Path(current_app.config["UPLOAD_FOLDER"])
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _cloudinary_configured() -> bool:
    return bool(
        current_app.config.get("CLOUDINARY_URL")
        or (
            current_app.config.get("CLOUDINARY_CLOUD_NAME")
            and current_app.config.get("CLOUDINARY_API_KEY")
            and current_app.config.get("CLOUDINARY_API_SECRET")
        )
    )


def _configure_cloudinary() -> None:
    if current_app.config.get("CLOUDINARY_URL"):
        cloudinary.config(secure=True)
    else:
        cloudinary.config(
            cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
            api_key=current_app.config["CLOUDINARY_API_KEY"],
            api_secret=current_app.config["CLOUDINARY_API_SECRET"],
            secure=True,
        )


def _cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale the image so it fully covers target_w × target_h, then center-crop.

    This mirrors the CSS ``object-fit: cover`` behaviour so the stored image
    always matches the container aspect ratio exactly, regardless of the
    original dimensions.
    """
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w = round(src_w * scale)
    new_h = round(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def save_product_image(
    product_id: int,
    file_stream: io.IOBase,
    mime_type: str,
    original_filename: str,
    alt_text: str | None = None,
) -> ProductImage:
    """Process and persist a product image.

    Validates the file type, applies cover-crop to the configured dimensions,
    saves the result as JPEG to ``UPLOAD_FOLDER``, creates a
    :class:`~app.models.catalog.product_image.ProductImage` record, and
    returns it.

    Raises :class:`~app.services.exceptions.ValidationError` for invalid
    files and :class:`~app.services.exceptions.ResourceNotFoundError` when the
    product does not exist.
    """
    from app.models.catalog.product import Product

    product = db.session.get(Product, product_id)
    if product is None:
        raise ResourceNotFoundError("Product not found")

    # --- validate mime type and extension ---
    mime_type = (mime_type or "").lower().split(";")[0].strip()
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"Unsupported file type '{mime_type}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
        )
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Unsupported file extension '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # --- open and process the image ---
    try:
        img = Image.open(file_stream)
        img.verify()  # detect truncated / corrupt files early
        # Re-open: verify() exhausts the stream and closes the image
        file_stream.seek(0)
        img = Image.open(file_stream)
        img.load()
    except Exception as exc:
        raise ValidationError("The uploaded file is not a valid image") from exc

    # Convert to RGB so we can always save as JPEG (handles RGBA/palette modes)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    target_w, target_h = _target_dims()
    img = _cover_crop(img, target_w, target_h)

    # Encode once so Cloudinary and the local fallback receive the exact same
    # cropped JPEG bytes.
    processed = io.BytesIO()
    img.save(processed, format="JPEG", quality=85, optimize=True)
    processed.seek(0)

    cloudinary_public_id: str | None = None
    if _cloudinary_configured():
        _configure_cloudinary()
        try:
            upload_result = cloudinary.uploader.upload(
                processed,
                folder=current_app.config["CLOUDINARY_FOLDER"],
                resource_type="image",
                format="jpg",
                use_filename=False,
                unique_filename=True,
            )
        except cloudinary.exceptions.Error as exc:
            raise StorageError("Could not upload the image to Cloudinary") from exc
        image_url = upload_result.get("secure_url")
        cloudinary_public_id = upload_result.get("public_id")
        if not image_url or not cloudinary_public_id:
            raise StorageError("Cloudinary returned an incomplete image response")
    else:
        filename = f"{uuid.uuid4().hex}.jpg"
        dest = _upload_dir() / filename
        dest.write_bytes(processed.getvalue())
        image_url = f"/uploads/{filename}"

    # --- determine the next sort_order ---
    existing_count = len(product.images)
    sort_order = existing_count  # 0-indexed

    # --- store record ---
    product_image = ProductImage(
        product_id=product_id,
        url=image_url,
        cloudinary_public_id=cloudinary_public_id,
        alt_text=alt_text or product.name,
        sort_order=sort_order,
    )
    db.session.add(product_image)
    db.session.commit()
    return product_image


def delete_product_image(image_id: int) -> ProductImage:
    """Soft-delete: removes the file from disk and the DB record."""
    image = db.session.get(ProductImage, image_id)
    if image is None:
        raise ResourceNotFoundError("Product image not found")

    if image.cloudinary_public_id:
        if not _cloudinary_configured():
            raise StorageError("Cloudinary is required to delete this image")
        _configure_cloudinary()
        try:
            result = cloudinary.uploader.destroy(
                image.cloudinary_public_id,
                resource_type="image",
                invalidate=True,
            )
        except cloudinary.exceptions.Error as exc:
            raise StorageError("Could not delete the image from Cloudinary") from exc
        if result.get("result") not in {"ok", "not found"}:
            raise StorageError("Cloudinary rejected the image deletion")
    elif image.url.startswith("/uploads/"):
        folder = _upload_dir()
        filename = Path(urlparse(image.url).path).name
        file_path = folder / filename
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)

    db.session.delete(image)
    db.session.commit()
    return image
