-- KORONA: nowe klasy bohaterów (mag, barbarzynca, druid) w ograniczeniach tabel.
alter table public.profiles drop constraint if exists profiles_favorite_skin_check;
alter table public.profiles add constraint profiles_favorite_skin_check
  check (favorite_skin in ('rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid'));
alter table public.match_results drop constraint if exists match_results_skin_check;
alter table public.match_results add constraint match_results_skin_check
  check (skin in ('rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid'));
