import re
import logging
from typing import Dict

logger = logging.getLogger("eve.services.localization.translator")

# Static translations mapping for Greeting, Small Talk, Capability Discovery, Thanks, and Goodbye.
# Allows easy extension to Spanish, French, German, etc.
TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "en": {
        "greeting": "Hello! I am EVE, your Enterprise Virtual Executive. I help fashion brand founders monitor financial health, optimize product pricing, manage inventory stockout risks, and run predictive scenarios. You can ask me things like 'What needs my attention?', 'Show me the financial health brief', or 'Simulate a 10% price increase'. How can I help you today?",
        "greeting_hi": "Hi! How can I help today?",
        "greeting_hello": "Hello! What can I help you with?",
        "greeting_hey": "Hey! What's on your mind?",
        "greeting_morning": "Good morning! How can I help you today?",
        "greeting_afternoon": "Good afternoon! How can I help you today?",
        "greeting_evening": "Good evening! How can I help you today?",
        "greeting_namaste": "Namaste! How can I help today?",
        "greeting_default": "Hello! How can I help today?",
        "small_talk": "I am doing great, thank you for asking! Ready to help you optimize your business operations and check key metrics. What would you like to focus on?",
        "capability": "I am a professional AI COO for D2C fashion brands. My key capabilities include:\n1. **Financial Analytics**: Tracking revenue, profit margins, and overhead expenses.\n2. **Inventory Safeguards**: Predicting stockout risks, overstock, and automated reorder suggestions.\n3. **Dynamic Pricing**: Recommended retail price optimizations.\n4. **Scenario Simulations**: Forecasting cash flow gaps and demand changes.\n\nYou can run analyses by typing queries like 'Show my dashboard metrics', 'Do we have pricing opportunities?', or 'Simulate demand decline by 20%'. What shall we inspect?",
        "thanks": "You're very welcome! I'm here to support your growth. Let me know if you need any other business analysis.",
        "goodbye": "Goodbye! Have a productive day running your brand. I'll be here whenever you need operational insights."
    },
    "hi": {
        "greeting": "नमस्ते! मैं EVE हूँ, आपकी एंटरप्राइज वर्चुअल एग्जीक्यूटिव। मैं फैशन ब्रांड संस्थापकों को वित्तीय स्थिति की निगरानी करने, उत्पाद की कीमतों को अनुकूलित करने, इन्वेंट्री स्टॉकआउट जोखिमों को प्रबंधित करने और भविष्य के परिदृश्यों का अनुकरण करने में मदद करती हूँ। आप मुझसे पूछ सकते हैं जैसे 'मुझे किस चीज़ पर ध्यान देने की आवश्यकता है?', 'मुझे वित्तीय स्वास्थ्य संक्षिप्त विवरण दिखाएं', या '10% मूल्य वृद्धि का अनुकरण करें'। आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_hi": "नमस्ते! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_hello": "नमस्ते! मैं आपकी क्या सहायता कर सकती हूँ?",
        "greeting_hey": "नमस्ते! आज क्या करना है?",
        "greeting_morning": "सुप्रभात! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_afternoon": "शुभ दोपहर! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_evening": "शुभ संध्या! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_namaste": "नमस्ते! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "greeting_default": "नमस्ते! आज मैं आपकी क्या मदद कर सकती हूँ?",
        "small_talk": "मैं बहुत अच्छी हूँ, पूछने के लिए धन्यवाद! आपके व्यावसायिक संचालन को अनुकूलित करने और प्रमुख मेट्रिक्स की जांच करने में मदद करने के लिए तैयार हूँ। आप किस चीज़ पर ध्यान केंद्रित करना चाहेंगे?",
        "capability": "मैं D2C फैशन ब्रांडों के लिए एक पेशेवर AI COO हूँ। मेरी प्रमुख क्षमताओं में शामिल हैं:\n1. **वित्तीय विश्लेषण**: राजस्व, लाभ मार्जिन और ओवरहेड खर्चों पर नज़र रखना।\n2. **इन्वेंटरी सुरक्षा**: स्टॉकआउट जोखिमों, ओवरस्टॉक और स्वचालित पुन: व्यवस्थित सुझावों की भविष्यवाणी करना।\n3. **गतिशील मूल्य निर्धारण**: अनुशंसित खुदरा मूल्य अनुकूलन।\n4. **परिदृश्य सिमुलेशन**: नकदी प्रवाह अंतराल और मांग में बदलाव का पूर्वानुमान लगाना।\n\nआप 'मेरे डैशबोर्ड मेट्रिक्स दिखाएं', 'क्या हमारे पास मूल्य निर्धारण के अवसर हैं?', या '20% मांग में गिरावट का अनुकरण करें' जैसे प्रश्न टाइप करके विश्लेषण चला सकते हैं। हम किस चीज़ की जांच करें?",
        "thanks": "आपका बहुत-बहुत स्वागत है! मैं आपकी वृद्धि का समर्थन करने के लिए यहाँ हूँ। यदि आपको किसी अन्य व्यावसायिक विश्लेषण की आवश्यकता हो तो मुझे बताएं।",
        "goodbye": "अलविदा! आपके ब्रांड को चलाने में आपका दिन उत्पादक रहे। जब भी आपको परिचालन संबंधी जानकारी की आवश्यकता होगी, मैं यहाँ रहूंगी।"
    },
    "es": {
        "greeting": "¡Hola! Soy EVE, tu Directora Virtual de Operaciones. Te ayudo a monitorear la salud financiera, optimizar precios y gestionar riesgos de stock.",
        "greeting_hi": "¡Hola! ¿Cómo te puedo ayudar hoy?",
        "greeting_hello": "¡Hola! ¿En qué te puedo ayudar?",
        "greeting_hey": "¡Hola! ¿Qué tienes en mente?",
        "greeting_morning": "¡Buenos días! ¿Cómo te puedo ayudar hoy?",
        "greeting_afternoon": "¡Buenas tardes! ¿Cómo te puedo ayudar hoy?",
        "greeting_evening": "¡Buenas noches! ¿Cómo te puedo ayudar hoy?",
        "greeting_namaste": "¡Namaste! ¿Cómo te puedo ayudar hoy?",
        "greeting_default": "¡Hola! ¿Cómo te puedo ayudar hoy?",
        "small_talk": "¡Estoy muy bien, gracias por preguntar! ¿En qué nos enfocamos hoy?",
        "capability": "Soy una COO de IA profesional para marcas de moda D2C.",
        "thanks": "¡De nada! Estoy aquí para apoyar tu crecimiento.",
        "goodbye": "¡Adiós! Que tengas un día productivo."
    },
    "fr": {
        "greeting": "Bonjour! Je suis EVE, votre directrice opérationnelle virtuelle.",
        "greeting_hi": "Salut! Comment puis-je t'aider aujourd'hui?",
        "greeting_hello": "Bonjour! En quoi puis-je vous aider?",
        "greeting_hey": "Salut! Qu'as-tu en tête?",
        "greeting_morning": "Bonjour! Comment puis-je vous aider aujourd'hui?",
        "greeting_afternoon": "Bon après-midi! Comment puis-je vous aider aujourd'hui?",
        "greeting_evening": "Bonsoir! Comment puis-je vous aider aujourd'hui?",
        "greeting_namaste": "Namaste! Comment puis-je vous aider aujourd'hui?",
        "greeting_default": "Bonjour! Comment puis-je vous aider aujourd'hui?",
        "small_talk": "Je vais très bien, merci! Sur quoi voulons-nous nous concentrer aujourd'hui?",
        "capability": "Je suis une COO IA professionnelle pour les marques de mode D2C.",
        "thanks": "Je vous en prie! Je suis là pour soutenir votre croissance.",
        "goodbye": "Au revoir! Passez une journée productive."
    },
    "de": {
        "greeting": "Hallo! Ich bin EVE, Ihre virtuelle Geschäftsführerin.",
        "greeting_hi": "Hallo! Wie kann ich dir heute helfen?",
        "greeting_hello": "Hallo! Womit kann ich Ihnen helfen?",
        "greeting_hey": "Hey! Was beschäftigt dich heute?",
        "greeting_morning": "Guten Morgen! Wie kann ich Ihnen heute helfen?",
        "greeting_afternoon": "Guten Tag! Wie kann ich Ihnen heute helfen?",
        "greeting_evening": "Guten Abend! Wie kann ich Ihnen heute helfen?",
        "greeting_namaste": "Namaste! Wie kann ich Ihnen heute helfen?",
        "greeting_default": "Hallo! Wie kann ich Ihnen heute helfen?",
        "small_talk": "Mir geht es hervorragend, danke der Nachfrage! Worauf wollen wir uns heute konzentrieren?",
        "capability": "Ich bin ein professioneller KI-COO für D2C-Modemarken.",
        "thanks": "Gern geschehen! Ich bin hier, um Ihr Wachstum zu unterstützen.",
        "goodbye": "Auf Wiedersehen! Haben Sie einen produktiven Tag."
    }
}


class LocalizationService:
    @staticmethod
    def get_static_translation(key: str, lang: str = "en") -> str:
        """
        Retrieves static localized templates for basic chat intents.
        Defaults to English if target language or key is unsupported.
        """
        lang_key = lang.lower() if lang else "en"
        if lang_key not in TRANSLATIONS:
            lang_key = "en"
        return TRANSLATIONS[lang_key].get(key, TRANSLATIONS["en"].get(key, ""))

    @staticmethod
    def get_greeting_by_query(question: str, lang: str = "en") -> str:
        """
        Dynamically selects a short, natural greeting template based on the user's input.
        """
        if not question:
            return LocalizationService.get_static_translation("greeting_default", lang)

        q = question.lower().strip()
        
        # Check specific keywords
        if re.search(r"\b(hi+|yo)\b", q):
            key = "greeting_hi"
        elif re.search(r"\b(hello+)\b", q):
            key = "greeting_hello"
        elif re.search(r"\b(hey+)\b", q):
            key = "greeting_hey"
        elif re.search(r"\b(namaste+)\b", q) or "नमस्ते" in q:
            key = "greeting_namaste"
        elif re.search(r"\b(morning)\b", q):
            key = "greeting_morning"
        elif re.search(r"\b(afternoon)\b", q):
            key = "greeting_afternoon"
        elif re.search(r"\b(evening)\b", q):
            key = "greeting_evening"
        else:
            key = "greeting_default"
            
        return LocalizationService.get_static_translation(key, lang)

    @staticmethod
    async def translate_explanation(text: str, lang: str, gemini_service) -> str:
        """
        Translates dynamic executive summaries and details into the target language.
        Keeps internal numbers, currencies, metrics, and SKU keys in English.
        """
        if not text or not lang or lang.lower() == "en":
            return text

        lang_key = lang.lower()
        if lang_key not in TRANSLATIONS:
            # We support hi, es, fr, de. Return text if not supported.
            return text

        lang_names = {
            "hi": "Hindi",
            "es": "Spanish",
            "fr": "French",
            "de": "German"
        }
        target_lang_name = lang_names.get(lang_key, "English")

        prompt = (
            f"You are a professional business translator. Translate the following executive COO analysis text into fluent {target_lang_name}.\n\n"
            "CRITICAL INSTRUCTION: Keep all business metrics, dollar amounts, currencies, percentages, and SKU codes exactly as they are in English alphanumeric characters "
            "(e.g., keep 'TSHIRT001', '$45,000', '83.0%', '20%', 'reorder cost of $1,250' exactly as is without translating numbers or SKUs to target alphabet/words).\n"
            "Only translate the conversational and operational explanation surrounding them.\n\n"
            f"Text to translate:\n{text}"
        )

        try:
            translated = await gemini_service.generate_text(
                prompt=prompt,
                system_instruction="You translate business explanations accurately while preserving numbers, currencies, and SKUs in English."
            )
            if translated and "empty response" not in translated.lower():
                return translated.strip()
            return text
        except Exception as e:
            logger.error(f"Failed to translate explanation to {target_lang_name}: {e}")
            return text
