"""
Relevance Engine — determines which data categories are relevant for each asset.

Example: oil price change → affects energy stocks, transportation, inflation
         wheat drought → affects food companies, fertilizer stocks, consumer staples
         VIX spike → affects all equities, options premiums
         USD strength → affects exporters, commodities priced in USD

This is NOT a filter — all data is still collected. This module provides
a relevance weight (0.0–1.0) and explanation for each data category,
so agents can intelligently focus their butterfly-effect analysis.
"""

ASSET_PROFILES = {
    # Equity sectors
    'energy':       ['commodities_energy','weather_oil','geopolitical','shipping'],
    'technology':   ['tech_news','regulatory','labor','social_sentiment','analyst'],
    'finance':      ['macro','central_banks','regulatory','yield_curve'],
    'healthcare':   ['regulatory_fda','health_news','clinical_trials'],
    'consumer':     ['consumer_data','agriculture','social_sentiment','labor'],
    'materials':    ['commodities','weather_agriculture','shipping','geopolitical'],
    'utilities':    ['energy_news','weather','regulatory','macro'],
    # Asset classes
    'crypto':       ['crypto','social_sentiment','macro','regulatory'],
    'forex':        ['macro','central_banks','geopolitical','labor'],
    'commodity':    ['weather_agriculture','shipping','geopolitical','supply_chain'],
    'bond':         ['macro','central_banks','inflation','yield_curve'],
    'index':        ['macro','all_sectors','social_sentiment','geopolitical'],
    'reit':         ['real_estate','macro','labor','consumer_data'],
    # Default
    'equity':       ['macro','news','social_sentiment','geopolitical','sector'],
}

# Global data categories and their general relevance weight
# These are layered on top of asset-specific profiles
BASE_WEIGHTS = {
    'macro':             0.9,   # central banks, rates — affects everything
    'geopolitical':      0.8,   # conflicts, sanctions — high impact
    'commodities':       0.75,  # price signals across supply chains
    'weather':           0.7,   # agricultural + energy disruption
    'social_sentiment':  0.6,   # crowd signal, short-term
    'shipping':          0.65,  # global trade indicator
    'news':              0.85,  # direct asset news
    'regulatory':        0.7,   # SEC, FDA, FTC actions
    'labor':             0.6,   # employment impacts consumer spending
    'tech_news':         0.5,   # relevant mainly for tech assets
    'agriculture':       0.6,   # food supply chain
    'energy_news':       0.65,  # broad inflation + transportation impact
    'health_news':       0.4,   # sector-specific mainly
    'crypto':            0.3,   # low relevance for traditional assets
    'esg':               0.4,   # growing regulatory relevance
    'consumer_data':     0.65,  # retail sales, confidence
}


def get_relevance_context(symbol: str, asset_type: str, uploaded_file_texts: list = None) -> str:
    """
    Returns a relevance guidance block injected into every agent's prompt.
    Tells agents which data categories to weight more heavily for this asset.
    """
    profile_key = asset_type.lower() if asset_type.lower() in ASSET_PROFILES else 'equity'
    high_priority = ASSET_PROFILES.get(profile_key, [])

    lines = [
        f"RELEVANCE GUIDANCE FOR {symbol} ({asset_type}):",
        f"High-priority data categories for this asset type: {', '.join(high_priority) if high_priority else 'general'}",
        "",
        "BUTTERFLY EFFECT PRIORITY — trace these chains first:",
    ]

    # Asset-type specific butterfly hints
    butterfly_hints = {
        'commodity':  ["weather alert → crop yield → supply → price", "shipping BDI → import costs → inflation"],
        'energy':     ["oil production → fuel costs → transportation margins → consumer prices"],
        'crypto':     ["macro rate decision → risk appetite → crypto sentiment → price", "social coordination → short squeeze"],
        'equity':     ["macro shift → sector rotation → specific stock repricing"],
        'forex':      ["central bank signal → rate differential → currency flow → asset"],
        'index':      ["broad macro signal → risk-on/off → index constituent repricing"],
    }

    hints = butterfly_hints.get(profile_key, butterfly_hints['equity'])
    for h in hints:
        lines.append(f"  › {h}")

    if uploaded_file_texts:
        lines.append("")
        lines.append(f"SUPPLEMENTARY RESEARCH FILES: {len(uploaded_file_texts)} file(s) provided.")
        lines.append("These files contain additional context uploaded by the analyst — weight this information heavily.")

    return '\n'.join(lines)
