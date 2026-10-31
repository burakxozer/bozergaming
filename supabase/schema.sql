-- Bozer Gaming: Supabase SQL Editor'da tek seferde çalıştırın.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  active_game text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  unique(requester_id,addressee_id), check(requester_id <> addressee_id)
);
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null, title text not null, state jsonb not null default '{}'::jsonb,
  is_live boolean not null default false, allow_watch boolean not null default true,
  updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id,created_at);
create index games_owner_idx on public.game_sessions(owner_id,updated_at desc);

create or replace function public.make_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare wanted text;
begin
  wanted := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  insert into public.profiles(id,username) values(new.id,wanted);
  return new;
exception when unique_violation then
  raise exception 'Bu kullanıcı adı kullanılıyor';
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.make_profile();

create or replace function public.admin_users()
returns table(id uuid, username text, email text, avatar_url text, active_game text, last_seen_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Yetkisiz erişim';
  end if;
  return query select p.id,p.username,u.email,p.avatar_url,p.active_game,p.last_seen_at,p.created_at
  from public.profiles p join auth.users u on u.id=p.id order by p.created_at desc;
end $$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.game_sessions enable row level security;
create policy "profile okunur" on public.profiles for select to authenticated using (true);
create policy "profilini günceller" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role='user');
create policy "arkadaşları görür" on public.friendships for select to authenticated using (requester_id=auth.uid() or addressee_id=auth.uid());
create policy "arkadaş isteği" on public.friendships for insert to authenticated with check (requester_id=auth.uid());
create policy "isteği yanıtlar" on public.friendships for update to authenticated using (addressee_id=auth.uid()) with check (addressee_id=auth.uid());
create policy "kendi mesajı" on public.messages for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy "arkadaşa mesaj" on public.messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=recipient_id) or (f.addressee_id=auth.uid() and f.requester_id=recipient_id))));
create policy "kendi oyunu" on public.game_sessions for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "izlenebilir oyun" on public.game_sessions for select to authenticated using (is_live and allow_watch and exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=owner_id) or (f.addressee_id=auth.uid() and f.requester_id=owner_id))));
create policy "admin profil görür" on public.profiles for select to authenticated using ((select role from public.profiles where id=auth.uid())='admin');

insert into storage.buckets(id,name,public) values('avatars','avatars',true) on conflict do nothing;
create policy "avatar yükle" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar güncelle" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar sil" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- İlk yönetici hesabını E-posta ile kullanıcı arayüzünden kaydettikten sonra çalıştırın:
-- update public.profiles set role='admin' where username='bozer';
-- Kullanıcının ilk şifresi arayüzden Bozerx123 olarak belirlenebilir; SQL içine şifre koymayın.
alter publication supabase_realtime add table public.messages, public.game_sessions;
