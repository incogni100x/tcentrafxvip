-- First, create the function that will be executed by the trigger.
create or replace function public.handle_withdrawal_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  user_balance numeric;
begin
  -- Check if the status is being updated to 'approved'
  if new.status = 'approved' and old.status <> 'approved' then
    -- Lock the user's profile row for this transaction
    select cash_balance into user_balance from public.profiles where id = new.user_id for update;

    -- Check if the user has sufficient funds at the moment of approval
    if user_balance < new.amount then
      -- Optionally, update the status to 'rejected' or just raise an error
      -- Here, we'll raise an exception, which will cancel the transaction.
      raise exception 'User balance is insufficient at the time of approval.';
    end if;

    -- Deduct the amount from the user's cash balance
    update public.profiles
    set cash_balance = cash_balance - new.amount
    where id = new.user_id;

    -- Update the withdrawal record's timestamps
    update public.withdrawals
    set approved_at = now()
    where id = new.id;
  
  -- (Optional but Recommended) Handle the case where an approved withdrawal is reversed
  elsif old.status = 'approved' and new.status <> 'approved' then
    -- This would happen if an admin reverses an approval (e.g., changes it back to 'pending' or 'rejected')
    -- In this case, we should refund the user's balance.
    update public.profiles
    set cash_balance = cash_balance + new.amount
    where id = new.user_id;
  end if;

  return new;
end;
$$;

-- Drop the existing trigger if it exists to avoid errors on re-running migrations
drop trigger if exists on_withdrawal_status_update on public.withdrawals;

-- Then, create the trigger to execute the function after an update on the withdrawals table.
create trigger on_withdrawal_status_update
after update of status on public.withdrawals
for each row
execute function public.handle_withdrawal_approval(); 