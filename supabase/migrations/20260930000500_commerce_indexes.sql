-- Covering index for the actor foreign key on order history (performance advisor).
create index order_status_history_actor_idx on public.order_status_history (actor_id);
