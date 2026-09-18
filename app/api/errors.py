import logging
from uuid import uuid4

from flask import Flask, g, jsonify, request
from flask_limiter.errors import RateLimitExceeded
from werkzeug.exceptions import BadRequest
from sqlalchemy.exc import IntegrityError

from app.services.exceptions import ServiceError

logger = logging.getLogger(__name__)


def _error_response(code: str, message: str, status_code: int):
    return jsonify(
        {
            "error": {
                "code": code,
                "message": message,
                "request_id": g.get("request_id"),
            }
        }
    ), status_code


def register_error_handlers(app: Flask) -> None:
    @app.before_request
    def assign_request_id():
        g.request_id = request.headers.get("X-Request-Id") or str(uuid4())

    @app.errorhandler(404)
    def not_found(_error):
        return _error_response("not_found", "Resource not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return _error_response("method_not_allowed", "Method not allowed", 405)

    @app.errorhandler(BadRequest)
    def bad_request(_error):
        return _error_response("bad_request", "The request is invalid", 400)

    @app.errorhandler(RateLimitExceeded)
    def rate_limit_exceeded(_error):
        # Do not leak limiter internals, but preserve the semantic HTTP status
        # so web and mobile clients can back off instead of treating it as a
        # server failure.
        return _error_response(
            "rate_limit_exceeded",
            "Too many requests. Please try again shortly.",
            429,
        )

    @app.errorhandler(IntegrityError)
    def integrity_error(_error):
        from app import db

        db.session.rollback()
        return _error_response(
            "integrity_error",
            "The operation violates a data constraint",
            409,
        )

    @app.errorhandler(ServiceError)
    def service_error(error: ServiceError):
        return _error_response(error.code, error.message, error.status_code)

    @app.errorhandler(Exception)
    def internal_server_error(error: Exception):
        from app import db

        db.session.rollback()
        logger.exception("Unhandled API error request_id=%s", g.get("request_id"), exc_info=error)
        return _error_response(
            "internal_server_error",
            "An unexpected error occurred",
            500,
        )
