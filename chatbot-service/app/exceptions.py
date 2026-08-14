class ServiceUnavailableError(Exception):
    status_code = 503

    def __init__(self, detail: str = "Tous les fournisseurs LLM sont indisponibles. Veuillez réessayer plus tard."):
        self.detail = detail
        super().__init__(detail)
