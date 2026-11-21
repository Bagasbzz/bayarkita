-- Keep editable catalog prices aligned with the public product cards.
UPDATE services
SET presets = '[{"label":"Go","amount":75000,"currency":"IDR"},{"label":"Plus","amount":285000,"currency":"IDR"},{"label":"Pro","amount":1889000,"currency":"IDR"},{"label":"Custom","amount":0,"currency":"IDR","custom":true}]'
WHERE slug = 'chatgpt';
