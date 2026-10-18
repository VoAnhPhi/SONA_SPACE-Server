-- Local QA fixture: one COD order owned by the first role=user account.
-- Idempotent. For local/dev databases only; never apply to staging or production.
-- Apply: docker exec -i furnitown_postgres psql -U postgres -d furnitown < db/seeds/local-commerce-fixture.sql
DO $$
DECLARE
  v_user_id    INTEGER;
  v_variant_id INTEGER;
  v_price      NUMERIC(12,2);
  v_payment_id INTEGER;
  v_order_id   INTEGER;
BEGIN
  SELECT user_id INTO v_user_id
  FROM "user" WHERE deleted_at IS NULL AND user_role = 'user'
  ORDER BY user_id LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No role=user account found; fixture skipped';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM orders WHERE order_hash = 'QAFIXTURE0001') THEN
    RAISE NOTICE 'Fixture order already present';
    RETURN;
  END IF;

  SELECT variant_id, variant_product_price INTO v_variant_id, v_price
  FROM variant_product ORDER BY variant_id LIMIT 1;

  INSERT INTO payments (payment_method, payment_status, payment_amount)
  VALUES ('cod', 'pending', v_price)
  RETURNING payment_id INTO v_payment_id;

  INSERT INTO orders (
    user_id, order_code, order_hash, order_status, order_total, order_discount,
    order_shipping_fee, order_final_total, order_address, order_phone, order_name,
    order_email, order_payment_method, payment_id
  )
  SELECT user_id, 'QAFIXTURE0001', 'QAFIXTURE0001', 0, v_price, 0, 0, v_price,
         COALESCE(NULLIF(user_address, ''), 'QA fixture address'),
         COALESCE(NULLIF(user_number, ''), '0900000000'),
         COALESCE(NULLIF(user_name, ''), 'QA Fixture'),
         user_gmail, 'cod', v_payment_id
  FROM "user" WHERE user_id = v_user_id
  RETURNING order_id INTO v_order_id;

  INSERT INTO order_items (order_id, variant_id, quantity, price)
  VALUES (v_order_id, v_variant_id, 1, v_price);
END $$;

-- Dedicated account for the client Playwright suite (SONA_SPACE-Client/tests/e2e).
-- Login: qa.e2e@sonaspace.test / QaE2e#2026!   (local databases only)
INSERT INTO "user" (user_name, user_gmail, user_number, user_password, user_address, user_role, user_email_active, user_verified_at)
SELECT 'QA E2E', 'qa.e2e@sonaspace.test', '0900000001', '$2a$10$FdUOWSxTyesJerCUYBqlxO4LogalzPSfxxTgEL9.lLl05Gk73i/Ly',
       '1 Duong QA, Phuong 1, Quan 1, TP.HCM', 'user', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE user_gmail = 'qa.e2e@sonaspace.test');
