-- Seed: word_cards — 50 cartes initiales
INSERT INTO word_cards (word_top, word_right, word_bottom, word_left, difficulty, tags) VALUES
-- Général facile
('CHAT', 'SOLEIL', 'POMME', 'MAISON', 'easy', ARRAY['animaux', 'nature']),
('CHIEN', 'LUNE', 'PAIN', 'JARDIN', 'easy', ARRAY['animaux', 'nature']),
('OISEAU', 'MER', 'FROMAGE', 'FORÊT', 'easy', ARRAY['animaux', 'nature']),
('LION', 'ÉTOILE', 'RAISIN', 'CHÂTEAU', 'easy', ARRAY['animaux']),
('POISSON', 'NUAGE', 'FRAISE', 'VILLE', 'easy', ARRAY['animaux', 'nature']),
('TIGRE', 'RIVIÈRE', 'CERISE', 'PONT', 'easy', ARRAY['animaux']),
('LAPIN', 'MONTAGNE', 'ORANGE', 'ÉCOLE', 'easy', ARRAY['animaux']),
('CHEVAL', 'DÉSERT', 'CITRON', 'ÉGLISE', 'easy', ARRAY['animaux']),
('VACHE', 'OCÉAN', 'MANGUE', 'MUSÉE', 'easy', ARRAY['animaux']),
('AIGLE', 'VOLCAN', 'ABRICOT', 'PHARE', 'easy', ARRAY['animaux']),

-- Général medium
('DOCTEUR', 'GUITARE', 'PARIS', 'FOOTBALL', 'medium', ARRAY['professions', 'culture']),
('PILOTE', 'PIANO', 'TOKYO', 'TENNIS', 'medium', ARRAY['professions', 'sports']),
('CHEF', 'VIOLON', 'ROME', 'NATATION', 'medium', ARRAY['professions', 'sports']),
('JUGE', 'FLÛTE', 'BERLIN', 'CYCLISME', 'medium', ARRAY['professions', 'sports']),
('POMPIER', 'BATTERIE', 'MADRID', 'ESCALADE', 'medium', ARRAY['professions', 'sports']),
('ARCHITECTE', 'TROMPETTE', 'LISBONNE', 'BOXE', 'medium', ARRAY['professions', 'musique']),
('ASTRONAUTE', 'SAXOPHONE', 'AMSTERDAM', 'JUDO', 'medium', ARRAY['professions', 'musique']),
('BIOLOGISTE', 'HARPE', 'VIENNE', 'KARATÉ', 'medium', ARRAY['professions', 'sciences']),
('JOURNALISTE', 'ACCORDÉON', 'PRAGUE', 'AVIRON', 'medium', ARRAY['professions']),
('VÉTÉRINAIRE', 'ORGUE', 'DUBLIN', 'RUGBY', 'medium', ARRAY['professions', 'sports']),

-- Général difficile
('ÉPISTÉMOLOGIE', 'FJORD', 'QUARK', 'PALIMPSESTE', 'hard', ARRAY['sciences', 'littérature']),
('RHIZOME', 'ATOLL', 'PHOTON', 'MÉTONYMIE', 'hard', ARRAY['sciences', 'littérature']),
('SYNAPSE', 'STEPPE', 'NEUTRON', 'ALLÉGORIE', 'hard', ARRAY['sciences']),
('ENTROPIE', 'KARST', 'PLASMA', 'CHIASME', 'hard', ARRAY['sciences', 'littérature']),
('HOMOLOGIE', 'TAÏGA', 'ISOTOPE', 'OXYMORE', 'hard', ARRAY['sciences', 'littérature']),

-- Culture pop
('MATRIX', 'BATMAN', 'ZELDA', 'JAZZ', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('INCEPTION', 'SUPERMAN', 'MARIO', 'BLUES', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('DUNE', 'SPIDERMAN', 'SONIC', 'ROCK', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('AVATAR', 'IRONMAN', 'TETRIS', 'POP', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('INTERSTELLAR', 'THOR', 'MINECRAFT', 'METAL', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('TITANIC', 'HULK', 'FORTNITE', 'RAP', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('JOKER', 'WOLVERINE', 'POKEMON', 'SOUL', 'medium', ARRAY['cinema', 'jeux', 'musique']),
('PARASITE', 'DEADPOOL', 'MINECRAFT', 'TECHNO', 'medium', ARRAY['cinema', 'jeux', 'musique']),

-- Product Management
('BACKLOG', 'SPRINT', 'PERSONA', 'ROADMAP', 'medium', ARRAY['product']),
('PIVOT', 'FUNNEL', 'CHURN', 'SCRUM', 'medium', ARRAY['product']),
('KANBAN', 'EPIC', 'STORY', 'RETRO', 'medium', ARRAY['product']),
('VELOCITY', 'OKR', 'KPI', 'MVP', 'medium', ARRAY['product']),
('GTM', 'NPS', 'DAU', 'MRR', 'medium', ARRAY['product']),
('DISCOVERY', 'DELIVERY', 'STAKEHOLDER', 'ITERATION', 'medium', ARRAY['product']),
('PROTOTYPING', 'BENCHMARK', 'ADOPTION', 'FEATURE', 'medium', ARRAY['product']),

-- Mix nature / objets
('BAMBOU', 'SABLE', 'MARÉE', 'BRUME', 'easy', ARRAY['nature']),
('GLACIER', 'TORRENT', 'SAISON', 'POLLEN', 'medium', ARRAY['nature']),
('CALCAIRE', 'LIMON', 'AURORE', 'BRUYÈRE', 'medium', ARRAY['nature']),
('CRISTAL', 'GRANIT', 'FALAISE', 'TOURBIÈRE', 'hard', ARRAY['nature']),
('CACTUS', 'CORAL', 'MANGROVE', 'TOUNDRA', 'medium', ARRAY['nature']),
('LENTILLE', 'PRISME', 'MIROIR', 'PENDULE', 'medium', ARRAY['sciences', 'objets']),
('BOUSSOLE', 'SEXTANT', 'ASTROLABE', 'COMPAS', 'medium', ARRAY['objets', 'navigation']),
('PARCHEMIN', 'ENCRE', 'CALAME', 'CODEX', 'hard', ARRAY['littérature', 'histoire']);
