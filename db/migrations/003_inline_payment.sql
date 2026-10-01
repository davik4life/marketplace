ALTER TABLE orders ADD COLUMN access_code text;
UPDATE orders SET access_code=substring(authorization_url from '^https://checkout[.]paystack[.]com/([A-Za-z0-9_-]+)$') WHERE authorization_url IS NOT NULL;
