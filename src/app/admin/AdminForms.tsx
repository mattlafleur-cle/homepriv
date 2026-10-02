"use client";

import { useActionState } from "react";
import { approveAction, declineAction, deleteAction, loginAction, refundAction, type ActionResult } from "./actions";

function Result({ state }: { state?: ActionResult }) {
  if (!state) return null;
  return (
    <div role="status" className={`mt-2 rounded-md p-2 text-[0.875rem] ${state.error ? "bg-open-bg text-open" : "bg-ok-bg text-ok"}`}>
      {state.error ?? state.ok}
      {state.link && (
        <p className="mt-1 break-all font-mono text-[0.8125rem] text-ink">
          <a className="text-link" href={state.link}>{state.link}</a>
        </p>
      )}
    </div>
  );
}

const small = "rounded-md border border-line bg-white px-2 py-1.5 text-[0.875rem]";
const btn = "rounded-md bg-evergreen px-3 py-1.5 text-[0.875rem] font-semibold text-white hover:bg-evergreen-deep disabled:opacity-60";
const btnGhost = "rounded-md border border-evergreen px-3 py-1.5 text-[0.875rem] font-semibold text-evergreen disabled:opacity-60";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field-input" required />
      </div>
      {state?.error && <p role="alert" className="field-error">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
    </form>
  );
}

export function ApproveForm({ id, label = "Approve and send link" }: { id: string; label?: string }) {
  const [state, action, pending] = useActionState(approveAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block text-[0.8125rem] text-muted">
        Internal note (optional)
        <input name="note" className={`${small} mt-1 w-full`} maxLength={500} />
      </label>
      <button className={btn} disabled={pending}>{pending ? "Working…" : label}</button>
      <Result state={state} />
    </form>
  );
}

export function DeclineForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(declineAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block text-[0.8125rem] text-muted">
        Reason sent to the customer
        <select name="reason" className={`${small} mt-1 w-full`} defaultValue="no_exposure">
          <option value="no_exposure">No removable listing content found</option>
          <option value="listed">Home is actively listed</option>
          <option value="out_of_area">Outside current service area</option>
          <option value="other">Other (generic wording)</option>
        </select>
      </label>
      <label className="block text-[0.8125rem] text-muted">
        Internal note (optional, not sent)
        <input name="note" className={`${small} mt-1 w-full`} maxLength={500} />
      </label>
      <button className={btnGhost} disabled={pending}>{pending ? "Working…" : "Decline and notify"}</button>
      <Result state={state} />
    </form>
  );
}

export function RefundForm({ order }: { order: string }) {
  const [state, action, pending] = useActionState(refundAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="order" value={order} />
      <label className="text-[0.8125rem] text-muted">
        Refund reason
        <input name="reason" className={`${small} ml-1`} maxLength={300} placeholder="e.g. before first request" />
      </label>
      <button className={btnGhost} disabled={pending}>{pending ? "Working…" : "Refund"}</button>
      <Result state={state} />
    </form>
  );
}

export function DeleteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-[0.8125rem] text-muted">
        Type DELETE
        <input name="confirm" className={`${small} ml-1 w-24`} autoComplete="off" />
      </label>
      <button className={btnGhost} disabled={pending}>Delete record</button>
      <Result state={state} />
    </form>
  );
}
