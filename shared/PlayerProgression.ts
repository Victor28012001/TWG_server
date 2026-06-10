export interface ProgressionData {
  level: number;
  xp: number;
  credits: number;
  kills: number;
  deaths: number;
  headshots: number;
  highestKillstreak: number;
  currentKillstreak: number;
  unlockedItems: string[];
  equippedSkin: string;
  dailyChallenges: DailyChallenge[];
  dailyChallengeProgress: { [challengeId: string]: number };
}

export interface DailyChallenge {
  id: string;
  name: string;
  target: number;
  reward: number;
  type: 'kills' | 'headshots' | 'killstreak' | 'wins';
}

export default class PlayerProgression {
  public data: ProgressionData;

  constructor() {
    this.data = {
      level: 1, xp: 0, credits: 0,
      kills: 0, deaths: 0, headshots: 0,
      highestKillstreak: 0, currentKillstreak: 0,
      unlockedItems: [], equippedSkin: 'default',
      dailyChallenges: [], dailyChallengeProgress: {}
    };
    this.generateDailyChallenges();
  }

  getXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  addKill(isHeadshot: boolean = false): { xpGained: number; creditsGained: number; leveledUp: boolean; newLevel?: number; newUnlocks?: string[] } {
    this.data.kills++;
    this.data.currentKillstreak++;
    if (this.data.currentKillstreak > this.data.highestKillstreak) this.data.highestKillstreak = this.data.currentKillstreak;

    let xpGained = 50, creditsGained = 10;
    if (isHeadshot) { this.data.headshots++; xpGained += 25; creditsGained += 5; }
    if (this.data.currentKillstreak >= 5) { xpGained += 50; creditsGained += 20; }
    if (this.data.currentKillstreak >= 10) { xpGained += 100; creditsGained += 50; }

    this.data.xp += xpGained;
    this.data.credits += creditsGained;

    let leveledUp = false, newLevel = this.data.level, newUnlocks: string[] = [];
    const xpToNext = this.getXPForLevel(this.data.level + 1);
    if (this.data.xp >= xpToNext) {
      this.data.xp -= xpToNext;
      this.data.level++;
      newLevel = this.data.level;
      leveledUp = true;
      this.data.credits += 100 * this.data.level;
      newUnlocks = this.checkUnlocks();
    }

    this.updateDailyChallenge('kills');
    if (isHeadshot) this.updateDailyChallenge('headshots');
    this.updateDailyChallenge('killstreak', this.data.currentKillstreak);

    return { xpGained, creditsGained, leveledUp, newLevel, newUnlocks };
  }

  addDeath() { this.data.deaths++; this.data.currentKillstreak = 0; }

  checkUnlocks(): string[] {
    const allItems = [
      { id: 'gold_skin', name: 'Gold Skin', requirement: 5 },
      { id: 'camo_skin', name: 'Camo Skin', requirement: 10 },
      { id: 'neon_skin', name: 'Neon Skin', requirement: 15 },
      { id: 'dragon_skin', name: 'Dragon Skin', requirement: 20 },
      { id: 'cyber_skin', name: 'Cyber Skin', requirement: 25 },
    ];
    const newUnlocks: string[] = [];
    allItems.forEach(item => {
      if (this.data.level >= item.requirement && !this.data.unlockedItems.includes(item.id)) {
        this.data.unlockedItems.push(item.id);
        newUnlocks.push(item.name);
      }
    });
    return newUnlocks;
  }

  generateDailyChallenges() {
    const challenges: DailyChallenge[] = [
      { id: 'kills', name: 'Get 10 Kills', target: 10, reward: 50, type: 'kills' },
      { id: 'headshots', name: '5 Headshots', target: 5, reward: 75, type: 'headshots' },
      { id: 'killstreak', name: '5 Kill Streak', target: 5, reward: 100, type: 'killstreak' },
    ];
    this.data.dailyChallenges = challenges;
    challenges.forEach(c => { this.data.dailyChallengeProgress[c.id] = 0; });
  }

  updateDailyChallenge(type: string, value: number = 1): DailyChallenge | null {
    const challenge = this.data.dailyChallenges.find(c => c.type === type);
    if (challenge) {
      if (type === 'killstreak') {
        this.data.dailyChallengeProgress[challenge.id] = Math.max(this.data.dailyChallengeProgress[challenge.id], value);
      } else {
        this.data.dailyChallengeProgress[challenge.id] = (this.data.dailyChallengeProgress[challenge.id] || 0) + value;
      }
      if (this.data.dailyChallengeProgress[challenge.id] >= challenge.target) {
        this.data.credits += challenge.reward;
        return challenge;
      }
    }
    return null;
  }

  getProgressionData(): ProgressionData { return { ...this.data }; }
}