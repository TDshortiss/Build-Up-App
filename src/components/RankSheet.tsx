import { DIVISIONS, levelInfo, levelName, RANKS, STREAK_GRACE, XP, xpForLevel, type Progress } from '../engine/progress';
import { fmtShort } from '../engine/dates';
import { Flame, RankBadge } from './visuals';
import { Sheet } from './ui';

export function XpBar({ into, needed, big }: { into: number; needed: number; big?: boolean }) {
  return (
    <div className={`xpbar${big ? ' big' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={needed} aria-valuenow={into} aria-label="XP to next level">
      <i style={{ width: `${Math.min(100, (into / needed) * 100)}%` }} />
    </div>
  );
}

/** Opened from the rank icon: progress to the next level, the ranks ahead, and how XP is earned. */
export function RankSheet({ progress, onClose }: { progress: Progress; onClose: () => void }) {
  const info = levelInfo(progress.xp);
  const currentRank = Math.min(Math.floor(info.level / DIVISIONS), RANKS.length - 1);
  return (
    <Sheet title="Your rank" onClose={onClose}>
      <div className="rank-hero">
        <RankBadge level={info.level} size={76} />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <h3 className="rank-name">{info.name}</h3>
          <XpBar into={info.into} needed={info.needed} big />
          <span className="fine mono">{info.into.toLocaleString()} / {info.needed.toLocaleString()} XP · <b>{(info.needed - info.into).toLocaleString()} to {levelName(info.level + 1)}</b></span>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Ranks</span>
        <ol className="ladder">
          {RANKS.map((r, i) => {
            const lvl = i * DIVISIONS;
            const state = i < currentRank ? 'done' : i === currentRank ? 'now' : 'locked';
            return (
              <li key={r.name} className={state}>
                <RankBadge level={lvl} size={30} locked={state === 'locked'} />
                <span className="ladder-name">{r.name}</span>
                <span className="fine mono">{state === 'done' ? 'Reached' : state === 'now' ? 'You are here' : `${xpForLevel(lvl).toLocaleString()} XP`}</span>
              </li>
            );
          })}
        </ol>
        <p className="fine">Each rank has three levels (I, II, III). Legend keeps counting up from there.</p>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">How to earn XP</span>
        <ul className="earn">
          <li><b>+{XP.workout}</b>Finish a workout</li>
          <li><b>+{XP.perExercise}</b>For each exercise you complete</li>
          <li><b>+{XP.pr}</b>Beat your best weight on a lift</li>
          <li><b>+{XP.streakPerDay}</b>Per streak day, every workout (up to +{XP.streakPerDay * XP.streakCap})</li>
          <li><b>+100</b>Streak milestones at 7, 14, 30 days and beyond (bigger each time)</li>
          <li><b>+{XP.rehabStage}</b>Pass a rehab progress check</li>
        </ul>
        <p className="fine">Up to {XP.perDay} workouts a day earn XP.</p>
      </div>

      {progress.events.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Recent XP</span>
          <ul className="xplog">
            {progress.events.slice(0, 8).map((e, i) => (
              <li key={i}><span><b>{e.label}</b>{e.detail && <small>{e.detail}</small>}</span><span className="mono">{fmtShort(e.date)}</span><span className="mono xp">+{e.xp}</span></li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

export function StreakSheet({ progress, onClose }: { progress: Progress; onClose: () => void }) {
  const s = progress.streak;
  const left = STREAK_GRACE - s.missed;
  return (
    <Sheet title="Your streak" onClose={onClose}>
      <div className="rank-hero">
        <Flame lit={s.count > 0} size={64} warn={s.status === 'last-chance'} />
        <div className="stack" style={{ gap: 4 }}>
          <h3 className="rank-name">{s.count} day{s.count === 1 ? '' : 's'}</h3>
          <span className="muted">{streakLine(progress)}</span>
          <span className="fine">Best: {s.best} days</span>
        </div>
      </div>
      <ul className="earn">
        <li><b>1</b>Every day you finish a workout adds a day to your streak.</li>
        <li><b>{STREAK_GRACE}</b>You can miss {STREAK_GRACE} days in a row and keep it. It just won't grow.</li>
        <li><b>{STREAK_GRACE + 1}</b>Miss {STREAK_GRACE + 1} days in a row and it resets to zero.</li>
        <li><b>0</b>Rest days in your plan don't count as missed.</li>
      </ul>
      {s.count > 0 && s.status !== 'done-today' && left >= 0 && <p className="note">{left === 0 ? 'Work out today to keep your streak.' : `You can miss ${left} more day${left === 1 ? '' : 's'} before it resets.`}</p>}
    </Sheet>
  );
}

export function streakLine(p: Progress): string {
  const s = p.streak;
  if (s.status === 'none') return p.records.length ? 'Finish a workout to start a new streak.' : 'Finish your first workout to start a streak.';
  if (s.status === 'done-today') return 'Done for today. Nice work.';
  if (s.status === 'last-chance') return 'Last chance: work out today or your streak resets.';
  return s.missed === 0 ? 'Work out today to grow it.' : `Safe for now. ${STREAK_GRACE - s.missed} more missed day${STREAK_GRACE - s.missed === 1 ? '' : 's'} allowed.`;
}

/** Shown once each time the user reaches a new level. */
export function LevelUp({ level, first, onClose }: { level: number; first: boolean; onClose: () => void }) {
  const name = levelName(level);
  const newRank = level % DIVISIONS === 0;
  return (
    <div className="scrim levelup" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Level up: ${name}`}>
        <div className="burst"><RankBadge level={level} size={120} /></div>
        <p className="label" style={{ textAlign: 'center' }}>{first ? 'Ranks are here' : newRank ? 'New rank' : 'Level up'}</p>
        <h2 style={{ textAlign: 'center', fontSize: 44, textTransform: 'uppercase' }}>{name}</h2>
        <p className="muted" style={{ textAlign: 'center' }}>
          {first ? 'Your past workouts already count. Keep training to climb from here.' : newRank ? `You made it to ${name.split(' ')[0]}. The next one takes a bit more work.` : 'Keep stacking workouts to reach the next rank.'}
        </p>
        <button className="btn block" onClick={onClose}>Keep going</button>
      </div>
    </div>
  );
}
