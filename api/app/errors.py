class DomainError(Exception):
    """A business rule said no. The message is shown to the user as-is."""

    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
