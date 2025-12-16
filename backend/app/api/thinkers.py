"""API routes for thinker suggestions and validation."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas import (
    ThinkerProfile,
    ThinkerSuggestion,
    ThinkerSuggestRequest,
    ThinkerValidateRequest,
    ThinkerValidateResponse,
)

router = APIRouter()

# Mock data for development without API key
MOCK_THINKERS: dict[str, ThinkerProfile] = {
    "socrates": ThinkerProfile(
        name="Socrates",
        bio="Ancient Greek philosopher from Athens (470-399 BC). Founder of Western philosophy.",
        positions="Known for the Socratic method of questioning, belief that wisdom begins with acknowledging ignorance.",
        style="Uses probing questions to examine beliefs. Humble yet persistent. Often claims to know nothing.",
    ),
    "aristotle": ThinkerProfile(
        name="Aristotle",
        bio="Ancient Greek philosopher (384-322 BC). Student of Plato, tutor to Alexander the Great.",
        positions="Virtue ethics, empiricism, logic. Believed in finding the golden mean between extremes.",
        style="Systematic and methodical. Builds arguments step by step. Favors observation and classification.",
    ),
    "marie curie": ThinkerProfile(
        name="Marie Curie",
        bio="Polish-French physicist and chemist (1867-1934). First woman to win a Nobel Prize.",
        positions="Pioneer in radioactivity research. Advocate for women in science.",
        style="Precise and methodical. Deeply passionate about scientific inquiry. Modest about achievements.",
    ),
    "albert einstein": ThinkerProfile(
        name="Albert Einstein",
        bio="German-born theoretical physicist (1879-1955). Developed the theory of relativity.",
        positions="Believed in the beauty and simplicity of nature's laws. Pacifist and humanitarian.",
        style="Uses vivid thought experiments. Playful yet profound. Often uses analogies and metaphors.",
    ),
    "maya angelou": ThinkerProfile(
        name="Maya Angelou",
        bio="American poet, memoirist, and civil rights activist (1928-2014).",
        positions="Champion of human dignity, civil rights, and the power of storytelling.",
        style="Eloquent and poetic. Draws from personal experience. Warm yet commanding presence.",
    ),
    "confucius": ThinkerProfile(
        name="Confucius",
        bio="Chinese philosopher and politician (551-479 BC). Founder of Confucianism.",
        positions="Emphasis on moral virtue, proper conduct, filial piety, and social harmony.",
        style="Uses aphorisms and parables. Values tradition and ritual. Teacher-like demeanor.",
    ),
}


def get_mock_suggestions(_topic: str, count: int) -> list[ThinkerSuggestion]:
    """Get mock thinker suggestions for development."""
    suggestions = [
        ThinkerSuggestion(
            name="Socrates",
            reason="Master of questioning and examining fundamental assumptions.",
            profile=MOCK_THINKERS["socrates"],
        ),
        ThinkerSuggestion(
            name="Albert Einstein",
            reason="Brilliant at connecting abstract concepts to real-world understanding.",
            profile=MOCK_THINKERS["albert einstein"],
        ),
        ThinkerSuggestion(
            name="Maya Angelou",
            reason="Brings wisdom from lived experience and artistic expression.",
            profile=MOCK_THINKERS["maya angelou"],
        ),
        ThinkerSuggestion(
            name="Aristotle",
            reason="Systematic thinker who categorizes and builds logical frameworks.",
            profile=MOCK_THINKERS["aristotle"],
        ),
        ThinkerSuggestion(
            name="Marie Curie",
            reason="Represents empirical science and perseverance in discovery.",
            profile=MOCK_THINKERS["marie curie"],
        ),
    ]
    return suggestions[:count]


@router.post("/suggest", response_model=list[ThinkerSuggestion])
async def suggest_thinkers(
    data: ThinkerSuggestRequest,
) -> list[ThinkerSuggestion]:
    """Get thinker suggestions for a topic.

    Uses Claude API if configured, otherwise returns mock suggestions.
    """
    from app.services.thinker import thinker_service

    settings = get_settings()

    if not settings.anthropic_api_key:
        # Return mock suggestions for development
        return get_mock_suggestions(data.topic, data.count)

    # Use the thinker service to get real suggestions
    suggestions = await thinker_service.suggest_thinkers(data.topic, data.count)
    if suggestions:
        return suggestions

    # Fallback to mock suggestions if API call fails
    return get_mock_suggestions(data.topic, data.count)


@router.post("/validate", response_model=ThinkerValidateResponse)
async def validate_thinker(
    data: ThinkerValidateRequest,
) -> ThinkerValidateResponse:
    """Validate that a thinker name refers to a real person.

    Uses Claude API if configured, otherwise uses mock validation.
    """
    from app.services.thinker import thinker_service

    settings = get_settings()
    name_lower = data.name.lower()

    # Check mock thinkers first
    if name_lower in MOCK_THINKERS:
        return ThinkerValidateResponse(
            valid=True,
            name=MOCK_THINKERS[name_lower].name,
            profile=MOCK_THINKERS[name_lower],
        )

    if not settings.anthropic_api_key:
        # In development without API key, only accept mock thinkers
        return ThinkerValidateResponse(
            valid=False,
            name=data.name,
            error=f"Unknown thinker: {data.name}. Try one of: Socrates, Aristotle, Marie Curie, Albert Einstein, Maya Angelou, Confucius",
        )

    # Use the thinker service to validate
    is_valid, profile = await thinker_service.validate_thinker(data.name)
    if is_valid and profile:
        return ThinkerValidateResponse(
            valid=True,
            name=profile.name,
            profile=profile,
        )

    return ThinkerValidateResponse(
        valid=False,
        name=data.name,
        error=f"Could not validate '{data.name}' as a real historical or contemporary figure",
    )
