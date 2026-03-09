import json


def format_analysis_for_display(analysis: dict) -> str:
    """Format the analysis dict into a human-readable string."""
    if "raw_analysis" in analysis:
        return analysis["raw_analysis"]

    labels = {
        "project_type": "Tipo de proyecto",
        "technologies": "Tecnologias",
        "client_technical_level": "Nivel tecnico del cliente",
        "complexity": "Complejidad",
        "urgency": "Urgencia",
        "suggested_architecture": "Arquitectura sugerida",
    }

    lines = []
    for key, label in labels.items():
        value = analysis.get(key, "N/A")
        if isinstance(value, list):
            value = ", ".join(value)
        lines.append(f"{label}: {value}")

    return "\n".join(lines)


def truncate_text(text: str, max_length: int = 200) -> str:
    """Truncate text to a maximum length with ellipsis."""
    if len(text) <= max_length:
        return text
    return text[:max_length].rstrip() + "..."
