-- Presentation-only rebrand. Preserve financial settings and historical records.
UPDATE settings
SET svalue = replace(replace(replace(replace(replace(svalue,
  'bayarkita.site', 'goisiinn.com'), 'BayarKita', 'Goisiinn'),
  'BAYARKITA', 'GOISIINN'), 'Bayarkita', 'Goisiinn'), 'bayarkita', 'goisiinn')
WHERE skey IN ('quick_replies', 'chat_greeting', 'chat_offline_note', 'order_auto_reply', 'ai_extra_sop')
  AND lower(svalue) LIKE '%bayarkita%';

-- No replacement Telegram account has been verified. Keep unrelated custom handles.
UPDATE settings SET svalue = ''
WHERE skey = 'telegram'
  AND lower(ltrim(svalue, '@')) IN ('bayarkitaofficial', 'bayarkitaid', 'fahmidev');
