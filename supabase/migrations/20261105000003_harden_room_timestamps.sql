-- KORONA: created_at/updated_at w rooms ustawia serwer, nie klient.
-- Wcześniej INSERT mógł podać created_at/updated_at z przyszłości i pokój omijał
-- sprzątanie cleanup_stale_rooms(); UPDATE właściciela mógł też przestawić created_at.

create or replace function public.rooms_set_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before insert or update on public.rooms
  for each row execute function public.rooms_set_timestamps();
