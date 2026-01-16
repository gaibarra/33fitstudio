import logging
from typing import Optional
from .models import AuditLog

logger = logging.getLogger(__name__)

def log_action(studio, actor, action, entity=None, entity_id=None, meta=None):
    AuditLog.objects.create(
        studio=studio,
        actor_user=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        meta=meta or {},
    )
    logger.info('audit', extra={'studio': str(studio.id) if studio else None, 'action': action, 'entity': entity, 'entity_id': str(entity_id) if entity_id else None, 'meta': meta or {}})
