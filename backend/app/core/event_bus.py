# ==============================================================================
# PURPOSE: Asynchronous In-Memory Event Bus for Agent Communication.
# DATA FLOW: Agents and services publish messages/events; subscribed handlers process them asynchronously.
# EXTENSION POINTS: Replace in-memory queues with Redis Pub/Sub, Kafka, or RabbitMQ for production scaling.
# ARCHITECTURAL DECISION:
# - Leverages python standard `asyncio` to handle asynchronous events concurrently.
# - Decouples agents by eliminating hardcoded imports or point-to-point bindings.
# ==============================================================================

import asyncio
import logging
from typing import Callable, Dict, List, Any, Awaitable

logger = logging.getLogger("eve.core.event_bus")


class Event:
    """
    Structured event payload carrying topic, data, and metadata.
    """
    def __init__(self, topic: str, data: Dict[str, Any], sender: str = "system"):
        self.topic = topic
        self.data = data
        self.sender = sender
        self.timestamp = asyncio.get_event_loop().time()


class EventBus:
    """
    Lightweight, in-memory event distribution bus.
    """
    _listeners: Dict[str, List[Callable[[Event], Awaitable[None]]]] = {}

    @classmethod
    def subscribe(cls, topic: str, handler: Callable[[Event], Awaitable[None]]):
        """
        Subscribes a coroutine function to a specific topic.
        """
        if topic not in cls._listeners:
            cls._listeners[topic] = []
        cls._listeners[topic].append(handler)
        logger.debug(f"Subscriber registered for topic: '{topic}' -> {handler.__name__}")

    @classmethod
    async def publish(cls, topic: str, data: Dict[str, Any], sender: str = "system"):
        """
        Asynchronously broadcasts an event to all subscribers of a topic.
        """
        event = Event(topic=topic, data=data, sender=sender)
        handlers = cls._listeners.get(topic, [])
        
        # Also support wildcard subscriptions (e.g. '*')
        wildcard_handlers = cls._listeners.get("*", [])
        all_handlers = handlers + wildcard_handlers

        if not all_handlers:
            logger.debug(f"Event published on '{topic}' but had no subscribers.")
            return

        logger.info(f"Publishing event '{topic}' from '{sender}' to {len(all_handlers)} listeners.")
        
        # Schedule all handlers to run concurrently
        tasks = [asyncio.create_task(handler(event)) for handler in all_handlers]
        
        # Wait for all handlers to kick off, but don't block indefinitely on failures
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res, handler in zip(results, all_handlers):
            if isinstance(res, Exception):
                logger.error(f"Error executing event handler {handler.__name__} on topic {topic}: {res}", exc_info=res)


# Global instance reference for import ease
event_bus = EventBus()
