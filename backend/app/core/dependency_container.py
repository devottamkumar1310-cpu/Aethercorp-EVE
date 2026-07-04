# ==============================================================================
# PURPOSE: Dependency Injection Container.
# DATA FLOW: Services register themselves during startup. Agents and APIs retrieve
#            service singletons or factory constructors.
# EXTENSION POINTS: Add lifecycle hooks (on_startup, on_shutdown), thread-local scopes,
#                    or third-party container integrations (e.g. Dependency Injector).
# ARCHITECTURAL DECISION:
# - Standardizes dependency resolution to avoid deep nesting of argument passing.
# - Promotes testability by allowing unit tests to easily mock/override singletons.
# ==============================================================================

import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger("eve.core.dependency_container")


class DependencyContainer:
    """
    Registry for service dependencies, supporting singletons and factory functions.
    """
    _services: Dict[str, Any] = {}
    _factories: Dict[str, Callable[[], Any]] = {}

    @classmethod
    def register_singleton(cls, key: str, instance: Any):
        """
        Registers a pre-instantiated singleton object.
        """
        cls._services[key] = instance
        logger.info(f"Registered singleton dependency: '{key}' -> {type(instance).__name__}")

    @classmethod
    def register_factory(cls, key: str, factory: Callable[[], Any]):
        """
        Registers a factory function that creates a new instance on every request.
        """
        cls._factories[key] = factory
        logger.info(f"Registered factory dependency: '{key}'")

    @classmethod
    def get(cls, key: str) -> Any:
        """
        Retrieves a dependency. Resolves singletons or runs factory functions.
        Throws a KeyError if the dependency is unregistered.
        """
        if key in cls._services:
            return cls._services[key]
        if key in cls._factories:
            return cls._factories[key]()
        raise KeyError(f"Dependency '{key}' has not been registered in the container.")

    @classmethod
    def get_optional(cls, key: str) -> Optional[Any]:
        """
        Retrieves a dependency, returning None if unregistered.
        """
        try:
            return cls.get(key)
        except KeyError:
            return None

    @classmethod
    def clear(cls):
        """
        Clears all registrations (primarily used to reset state between test cases).
        """
        cls._services.clear()
        cls._factories.clear()
        logger.debug("Dependency container cleared.")


# Global instance reference for ease of import
container = DependencyContainer()
