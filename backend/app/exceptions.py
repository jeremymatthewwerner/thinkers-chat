"""Application exceptions."""


class ThinkerAPIError(Exception):
    """Exception raised when the thinker API fails."""

    def __init__(self, message: str, is_quota_error: bool = False):
        self.message = message
        self.is_quota_error = is_quota_error
        super().__init__(message)
