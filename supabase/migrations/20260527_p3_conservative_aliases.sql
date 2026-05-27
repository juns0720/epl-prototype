-- P3 conservative matching hardening.
-- These short club aliases caused false positives such as @TheAthleticFC -> CFC
-- or generic "City/United" mentions. Keep them for audit history, but disable
-- automatic matching in live projects.

update public.team_aliases
set
  active = false,
  notes = concat_ws(' | ', nullif(notes, ''), 'P3 보수 매칭: 짧거나 넓은 club alias라 자동 매칭 제외'),
  updated_at = now()
where entity_type = 'club'
  and lower(alias) in ('afc', 'blues', 'city', 'reds', 'united', 'utd');
