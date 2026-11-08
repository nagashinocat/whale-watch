-- みんなのギャラリーのデータ置き場(Supabase)を用意する設定文。
-- Supabase の「SQL Editor」に、このファイルの中身をまるごと貼りつけて「Run」を押すだけ。何度実行しても大丈夫。
--
-- できること(公開してよい鍵 = anon key でできるのは、ここで決めたことだけ):
--   ・だれでも: 載っている写真を見る / 写真を新しく載せる(A ランク以上、決まった形のものだけ)
--   ・だれもできない: 人の写真を書きかえる・消す(消すのは運営だけ。Supabase の画面から)
-- 写真を見えなくしたいとき: 「Table Editor」→ gallery → その行の hidden に ✓ を付ける

-- ① 点数や名前を書く表
create table if not exists public.gallery (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  taken_at timestamptz,
  image_path text not null check (image_path ~ '^[0-9]{4}-[0-9]{2}/[a-z0-9]{16}\.jpg$'),
  score smallint not null check (score between 0 and 100),
  rank text not null check (rank in ('S', 'A')),
  composition smallint not null check (composition between 0 and 60),
  rarity smallint not null check (rarity between 0 and 40),
  notes jsonb not null default '[]' check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 3 and length(notes::text) < 800),
  whales jsonb not null default '[]' check (jsonb_typeof(whales) = 'array' and jsonb_array_length(whales) <= 8 and length(whales::text) < 1000),
  lang text not null default 'ja' check (lang in ('ja', 'en')),
  hidden boolean not null default false,
  -- 点数のつじつま(写り方 + めずらしさ = 合計、合計に合ったランク)
  check (score = composition + rarity),
  check ((rank = 'S' and score >= 90) or (rank = 'A' and score >= 75 and score < 90))
);
create index if not exists gallery_created_idx on public.gallery (created_at desc);
create index if not exists gallery_score_idx on public.gallery (score desc);

alter table public.gallery enable row level security;
drop policy if exists "gallery_read" on public.gallery;
create policy "gallery_read" on public.gallery for select to anon, authenticated using (hidden = false);
drop policy if exists "gallery_post" on public.gallery;
create policy "gallery_post" on public.gallery for insert to anon, authenticated with check (hidden = false);
revoke update, delete on public.gallery from anon, authenticated;
grant select, insert on public.gallery to anon, authenticated;

-- 一度にたくさん送られたら止める(10分に60枚まで)
create or replace function public.gallery_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.gallery where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'too many posts, please wait';
  end if;
  return new;
end $$;
drop trigger if exists gallery_rate_limit on public.gallery;
create trigger gallery_rate_limit before insert on public.gallery for each row execute function public.gallery_rate_limit();

-- ② 写真を置く場所(だれでも見られる。置けるのは 400KB までの JPEG だけ)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 400000, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 400000, allowed_mime_types = array['image/jpeg'];

drop policy if exists "gallery_upload" on storage.objects;
create policy "gallery_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'gallery' and name ~ '^[0-9]{4}-[0-9]{2}/[a-z0-9]{16}\.jpg$');
-- 置いた直後の確かめに使う(だれでも見られる写真置き場なので、見えても困らない)
drop policy if exists "gallery_view" on storage.objects;
create policy "gallery_view" on storage.objects for select to anon, authenticated using (bucket_id = 'gallery');
