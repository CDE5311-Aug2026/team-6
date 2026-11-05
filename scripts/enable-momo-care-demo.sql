-- Enable the new-account scenario only after deploying the matching frontend/assets.
-- Existing personal_workspaces are intentionally not updated.
update pawsona_private.demo_pet_templates
set pet = jsonb_set(pet, '{workspace,momoCareDemo}', '{"version":1}'::jsonb, true)
where id = 'momo-seven-days-20261105-v1' and enabled
  and pet->>'id' = 'pet-demo-momo-20261105-v1';

-- Rollback for future accounts:
-- update pawsona_private.demo_pet_templates
-- set pet = pet #- '{workspace,momoCareDemo}'
-- where id = 'momo-seven-days-20261105-v1';
