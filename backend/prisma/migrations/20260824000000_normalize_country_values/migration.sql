-- Normalize countryOfOrigin values with broken encodings.
-- Uses LIKE % patterns to match any character including U+FFFD replacement chars.

-- Côte d'Ivoire: C?te d'?ivoire (ô or apostrophe may be corrupted)
UPDATE "Contact" SET "countryOfOrigin" = 'Côte d''Ivoire'
  WHERE "countryOfOrigin" LIKE 'C%te d%ivoire%'
    AND "countryOfOrigin" != 'Côte d''Ivoire';

-- Égypte: ?gypte or _gypte
UPDATE "Contact" SET "countryOfOrigin" = 'Égypte'
  WHERE ("countryOfOrigin" LIKE '%gypte' OR "countryOfOrigin" LIKE '%Gypte')
    AND "countryOfOrigin" != 'Égypte';

-- Guinée: Guin?e (not Guinée-Bissau or Guinée équatoriale)
UPDATE "Contact" SET "countryOfOrigin" = 'Guinée'
  WHERE "countryOfOrigin" LIKE 'Guin%ee'
    AND "countryOfOrigin" NOT LIKE 'Guin%-%'
    AND "countryOfOrigin" NOT LIKE 'Guin%qua%'
    AND "countryOfOrigin" != 'Guinée';

-- Guinée-Bissau
UPDATE "Contact" SET "countryOfOrigin" = 'Guinée-Bissau'
  WHERE "countryOfOrigin" LIKE 'Guin%-Bissau%'
    AND "countryOfOrigin" != 'Guinée-Bissau';

-- Guinée équatoriale
UPDATE "Contact" SET "countryOfOrigin" = 'Guinée équatoriale'
  WHERE "countryOfOrigin" LIKE 'Guin%quatoriale%'
    AND "countryOfOrigin" != 'Guinée équatoriale';

-- Sénégal: Sn?gal or S?n?gal
UPDATE "Contact" SET "countryOfOrigin" = 'Sénégal'
  WHERE "countryOfOrigin" LIKE 'S%gal%'
    AND lower("countryOfOrigin") LIKE 'senegal%'
    AND "countryOfOrigin" != 'Sénégal';

-- Algérie: Alg?rie
UPDATE "Contact" SET "countryOfOrigin" = 'Algérie'
  WHERE "countryOfOrigin" LIKE 'Alg%rie%'
    AND lower("countryOfOrigin") LIKE 'algeri%'
    AND "countryOfOrigin" != 'Algérie';

-- Tunisie: Tun?sie
UPDATE "Contact" SET "countryOfOrigin" = 'Tunisie'
  WHERE "countryOfOrigin" LIKE 'Tun%sie%'
    AND "countryOfOrigin" != 'Tunisie';

-- Maroc: M?roc
UPDATE "Contact" SET "countryOfOrigin" = 'Maroc'
  WHERE "countryOfOrigin" LIKE 'M%roc%'
    AND "countryOfOrigin" != 'Maroc';

-- Generic: strip any remaining replacement characters (fallback)
UPDATE "Contact" SET "countryOfOrigin" = regexp_replace("countryOfOrigin", '[^[:print:]]', '', 'g')
WHERE "countryOfOrigin" ~ '[^[:print:]]';
