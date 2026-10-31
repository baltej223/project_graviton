class EngineError(Exception):
    """Base class for expected processing-engine failures."""

    code = "engine_error"

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.field = field


class InvalidInputError(EngineError):
    code = "invalid_input"


class UnsupportedFormatError(EngineError):
    code = "unsupported_format"


class InvalidConfigurationError(EngineError):
    code = "invalid_configuration"
