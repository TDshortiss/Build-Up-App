import { useState } from 'react';
import { REFERRAL } from '../engine/progress';
import { fmtShort } from '../engine/dates';
import type { Referrals } from '../engine/types';
import { nativeShareLink } from '../state/native';
import { inviteUrl } from '../state/referrals';
import { Sheet } from './ui';

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

/** Invite friends: the personal link, what both people get, and who has joined. */
export function InviteSheet({ referrals, signedIn, onClose }: { referrals: Referrals | undefined; signedIn: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = referrals?.code ?? null;
  const link = code ? inviteUrl(code) : null;
  const friends = referrals?.friends ?? [];
  const counted = friends.filter(f => f.activeAt).length;
  const text = 'I\'m training with Build Up: a free plan built around your sport, schedule and injuries. Join me and we both get bonus XP:';

  const share = async () => {
    if (!link) return;
    if (await nativeShareLink({ title: 'Build Up', text, url: link })) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Build Up', text, url: link }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    if (await copy(`${text} ${link}`)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <Sheet title="Invite friends" onClose={onClose}>
      <div className="invite-hero">
        <div><b className="mono">+{REFERRAL.inviter}</b><span>XP for you</span></div>
        <div><b className="mono">+{REFERRAL.friend}</b><span>XP for them</span></div>
      </div>
      <p>Send a friend your link. When they sign up and finish their first workout, you both get bonus XP.</p>

      {link ? (<>
        <div className="invite-link">
          <span className="mono">{link.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <button className="linkbtn" onClick={async () => { if (await copy(link)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <button className="btn block" onClick={share}>Share my invite</button>
        <p className="fine">Your code: <b className="mono">{code}</b></p>
      </>) : (
        <p className="note">{signedIn ? 'Getting your invite link… Check your connection if it doesn\'t show up.' : 'Invites need an account, so your friends\' sign-ups can be matched to you.'}</p>
      )}

      {friends.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Friends who joined · {counted} counted</span>
          <ul className="xplog">
            {friends.map((f, i) => (
              <li key={i}>
                <span><b>{f.name || 'A friend'}</b><small>{f.activeAt ? 'Finished a workout' : 'Signed up, no workout yet'}</small></span>
                <span className="mono">{fmtShort(f.joinedAt.slice(0, 10))}</span>
                <span className="mono xp">{f.activeAt ? `+${REFERRAL.inviter}` : '…'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {referrals?.invitedBy && (
        <p className="fine">You joined with {referrals.invitedBy.name ? `${referrals.invitedBy.name}'s` : 'a friend\'s'} invite{referrals.invitedBy.activeAt ? `, and you both got bonus XP.` : '. Finish your first workout and you both get bonus XP.'}</p>
      )}
      <p className="fine">Bonus XP counts for up to {REFERRAL.maxFriends} friends.</p>
    </Sheet>
  );
}
