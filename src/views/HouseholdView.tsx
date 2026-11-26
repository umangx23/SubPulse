import React, { useMemo, useState } from 'react';
import { computeInitials, formatMoney, getUserSharePrice } from '../lib/formatters';
import { AppSettings, HouseholdMember, Subscription } from '../types/subpulse';

interface HouseholdViewProps {
  subscriptions: Subscription[];
  members: HouseholdMember[];
  settings: AppSettings;
  onBack: () => void;
  onSelectSubscription: (id: string) => void;
  onInviteMember: (member: HouseholdMember) => void;
  onToggleSettleMember: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  subscriptions,
  members,
  settings,
  onBack,
  onSelectSubscription,
  onInviteMember,
  onToggleSettleMember,
  onShowToast,
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Editor' | 'Viewer'>('Editor');

  const sharedSubs = useMemo(
    () => subscriptions.filter((s) => s.isShared && s.status !== 'cancelled'),
    [subscriptions]
  );

  const sharedMonthlyTotal = useMemo(
    () => sharedSubs.reduce((sum, s) => sum + s.price, 0),
    [sharedSubs]
  );

  const perHouseholdMember = members.length > 0 ? sharedMonthlyTotal / members.length : sharedMonthlyTotal;

  const handleShareSummary = async () => {
    const lines = [
      `${settings.workspaceName} Household Subscriptions (${settings.currency})`,
      `Total shared plans: ${sharedSubs.length} (${formatMoney(sharedMonthlyTotal, settings.currency)}/mo)`,
      ...sharedSubs.map(
        (s) => `- ${s.name}: ${formatMoney(s.price, s.currency)} (${s.splitCount} ways · ${formatMoney(getUserSharePrice(s), s.currency)} each)`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      onShowToast('Read-only split summary copied to clipboard');
    } catch {
      onShowToast('Summary ready to share');
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const newMember: HouseholdMember = {
      id: `m-${Date.now()}`,
      name: inviteName.trim(),
      initials: computeInitials(inviteName),
      avatarColor: 'bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary',
      role: inviteRole,
      email: inviteEmail.trim(),
      settledThisMonth: false,
      customOwes: Number((sharedMonthlyTotal / (members.length + 1)).toFixed(2)),
    };
    onInviteMember(newMember);
    setInviteName('');
    setInviteEmail('');
    setShowInviteModal(false);
    onShowToast(`Invitation sent to ${newMember.email}`);
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Contextual Header */}
      <header className="px-page-margin lg:px-gutter-xl pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Settings"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
        </button>
        <h1 className="font-headline text-title-md lg:text-headline-md text-light-on-surface dark:text-dark-on-surface">
          Household
        </h1>
        <button
          type="button"
          onClick={handleShareSummary}
          aria-label="Share read-only summary"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest text-light-primary dark:text-dark-primary border border-light-outline-variant dark:border-dark-outline-variant"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">ios_share</span>
        </button>
      </header>

      <main className="px-page-margin lg:px-gutter-xl flex flex-col gap-gutter-lg flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto lg:mx-0">
        {/* Household Summary */}
        <section
          aria-label="Household summary"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex items-center justify-between gap-gutter-md"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {settings.workspaceName} Workspace
            </span>
            <span className="font-headline text-headline-lg-mobile text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {formatMoney(sharedMonthlyTotal, settings.currency)} / mo
            </span>
            <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {sharedSubs.length} shared family plans
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-sm shrink-0"
          >
            Invite
          </button>
        </section>

        {/* Members & Permissions */}
        <section
          aria-label="Household members"
          className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_4px_20px_-2px_rgba(26,27,35,0.06)] flex flex-col gap-gutter-md"
        >
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
            Members
          </h2>

          {members.map((member, idx) => (
            <div
              key={member.id}
              className={`flex items-center justify-between gap-gutter-md ${
                idx > 0 ? 'pt-gutter-sm border-t border-light-outline-variant dark:border-dark-outline-variant' : ''
              }`}
            >
              <div className="flex items-center gap-gutter-md min-w-0">
                <div
                  className={`w-10 h-10 rounded-full ${member.avatarColor} flex items-center justify-center font-headline text-label-lg shrink-0`}
                >
                  {member.initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface truncate">
                    {member.name}
                  </span>
                  <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    {member.role} ·{' '}
                    {member.role === 'Owner'
                      ? 'Can edit & export'
                      : member.settledThisMonth
                      ? 'Settled this month'
                      : `Owes ${formatMoney(member.customOwes ?? perHouseholdMember, settings.currency)}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-gutter-sm shrink-0">
                {member.role !== 'Owner' && (
                  <button
                    type="button"
                    onClick={() => onToggleSettleMember(member.id)}
                    className="min-h-[36px] px-3 py-1 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-primary dark:text-dark-primary font-label text-label-sm"
                  >
                    {member.settledThisMonth ? 'Settled' : 'Mark settled'}
                  </button>
                )}
                <span className="font-mono text-mono-sm text-light-on-surface dark:text-dark-on-surface tabular-nums">
                  {formatMoney(perHouseholdMember, settings.currency)}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Shared Subscriptions */}
        <section aria-label="Shared plans" className="flex flex-col gap-gutter-sm">
          <h2 className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface px-1">
            Shared subscriptions
          </h2>

          {sharedSubs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubscription(sub.id)}
              className="w-full text-left rounded-lg bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-lg shadow-[0_2px_12px_-2px_rgba(26,27,35,0.05)] flex items-center justify-between gap-gutter-md hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-title text-title-md text-light-on-surface dark:text-dark-on-surface">
                  {sub.name}
                </span>
                <span className="font-body text-body-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  {sub.splitCount} seats · {formatMoney(getUserSharePrice(sub), sub.currency)} each
                </span>
              </div>
              <span className="font-mono text-mono-md text-light-on-surface dark:text-dark-on-surface tabular-nums">
                {formatMoney(sub.price, sub.currency)}
              </span>
            </button>
          ))}
        </section>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleInviteSubmit}
            className="w-full max-w-md rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest p-gutter-xl shadow-xl flex flex-col gap-gutter-md border border-light-outline-variant dark:border-dark-outline-variant"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-headline-md text-light-on-surface dark:text-dark-on-surface">
                Invite household member
              </h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-name" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Full name
              </label>
              <input
                id="inv-name"
                type="text"
                required
                placeholder="Jordan Taylor"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-email" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Email address
              </label>
              <input
                id="inv-email"
                type="email"
                required
                placeholder="jordan@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-role" className="font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Permission
              </label>
              <select
                id="inv-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'Editor' | 'Viewer')}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-DEFAULT bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
              >
                <option value="Editor">Editor (can add &amp; edit splits)</option>
                <option value="Viewer">Viewer (read-only)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-gutter-sm pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-label text-label-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-md bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary font-label text-label-lg"
              >
                Send invite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
