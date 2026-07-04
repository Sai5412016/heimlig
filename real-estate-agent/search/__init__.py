"""Search providers. Each module implements one real estate source.

To add a new source, subclass ``search.base.SearchProvider`` and register
the class in ``PROVIDERS`` below so it can be selected via ``config.yaml``
(``search.sources``).
"""

from search.immobilienscout import ImmobilienScoutProvider
from search.immowelt import ImmoweltProvider
from search.kleinanzeigen import KleinanzeigenProvider

PROVIDERS = {
    ImmobilienScoutProvider.name: ImmobilienScoutProvider,
    ImmoweltProvider.name: ImmoweltProvider,
    KleinanzeigenProvider.name: KleinanzeigenProvider,
}
