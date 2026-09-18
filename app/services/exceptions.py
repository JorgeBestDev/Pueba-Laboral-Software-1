class ServiceError(Exception):
    code = "service_error"
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ResourceNotFoundError(ServiceError):
    code = "not_found"
    status_code = 404


class ValidationError(ServiceError):
    code = "validation_error"
    status_code = 400


class BusinessRuleError(ServiceError):
    code = "business_rule_violation"
    status_code = 409


class AuthenticationError(ServiceError):
    code = "authentication_required"
    status_code = 401


class DeliveryError(ServiceError):
    code = "delivery_unavailable"
    status_code = 503


class StorageError(ServiceError):
    code = "storage_unavailable"
    status_code = 503
