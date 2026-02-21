# Weapon Balance Reference

## Zombie Health

| Zombie | HP | Speed | Damage | Attack CD | XP |
|---|---|---|---|---|---|
| **Walker** | 60 | 3.5 | 10 | 1.0s | 10 |
| **Runner** | 40 | 7.0 | 8 | 0.8s | 15 |
| **Tank** | 200 | 2.0 | 25 | 1.5s | 30 |

---

## Weapon Stats

| Stat | Pistol | Rifle | Uzi | Shotgun |
|---|---|---|---|---|
| Damage | 20 | 35 | 10 | 8 (x6 pellets) |
| Fire Rate (sec) | 0.3 | 0.8 | 0.1 | 1.0 |
| Magazine | 12 | 8 | 30 | 6 |
| Reload Time (sec) | 1.5 | 2.5 | 1.8 | 2.2 |
| Projectile Speed | 40 | 60 | 35 | 30 |
| Range | 30 | 80 | 20 | 12 |
| Pellets | 1 | 1 | 1 | 6 |
| Spread Angle | 0 | 0 | 0 | 0.35 rad |
| Hotkey | 1 | 2 | 3 | 4 |

---

## Damage Falloff

Falloff is **linear** from `falloffStart` down to `falloffMinMult` at max range.

| Stat | Pistol | Rifle | Uzi | Shotgun |
|---|---|---|---|---|
| Has Falloff | yes | **no** | yes | yes |
| Falloff Start | 15 | - | 10 | 5 |
| Min Multiplier | 0.5 | 1.0 | 0.6 | 0.3 |

---

## Damage at Distance

### Pistol (20 dmg, range 30, falloff 15-30, min 50%)

| Distance | 0 | 7.5 | 15 | 22.5 | 30 |
|---|---|---|---|---|---|
| **Damage** | 20 | 20 | 20 | 15 | 10 |
| **% of max** | 100% | 100% | 100% | 75% | 50% |

### Rifle (35 dmg, range 80, NO falloff)

| Distance | 0 | 20 | 40 | 60 | 80 |
|---|---|---|---|---|---|
| **Damage** | 35 | 35 | 35 | 35 | 35 |
| **% of max** | 100% | 100% | 100% | 100% | 100% |

### Uzi (10 dmg, range 20, falloff 10-20, min 60%)

| Distance | 0 | 5 | 10 | 15 | 20 |
|---|---|---|---|---|---|
| **Damage** | 10 | 10 | 10 | 8 | 6 |
| **% of max** | 100% | 100% | 100% | 80% | 60% |

### Shotgun (8 dmg x6 pellets, range 12, falloff 5-12, min 30%)

| Distance | 0 | 2.5 | 5 | 8.5 | 12 |
|---|---|---|---|---|---|
| **Per pellet** | 8 | 8 | 8 | 4 | 2 |
| **All 6 hit** | 48 | 48 | 48 | 24 | 12 |
| **% of max** | 100% | 100% | 100% | 50% | 30% |

---

## Shots to Kill

### Point Blank (distance = 0)

| Weapon | vs Walker (60 HP) | vs Runner (40 HP) | vs Tank (200 HP) |
|---|---|---|---|
| **Pistol** (20/shot, 0.3s) | 3 shots (0.6s) | 2 shots (0.3s) | 10 shots (2.7s) |
| **Rifle** (35/shot, 0.8s) | 2 shots (0.8s) | 2 shots (0.8s) | 6 shots (4.0s) |
| **Uzi** (10/shot, 0.1s) | 6 shots (0.5s) | 4 shots (0.3s) | 20 shots (1.9s) |
| **Shotgun** (48/shot, 1.0s) | 2 shots (1.0s) | 1 shot (0s) | 5 shots (4.0s) |

### Mid Range (halfway through falloff zone)

| Weapon | Dmg/shot | vs Walker | vs Runner | vs Tank |
|---|---|---|---|---|
| **Pistol** @22.5 | 15 | 4 shots | 3 shots | 14 shots |
| **Rifle** @40 | 35 | 2 shots | 2 shots | 6 shots |
| **Uzi** @15 | 8 | 8 shots | 5 shots | 25 shots |
| **Shotgun** @8.5 | ~24 total | 3 shots | 2 shots | 9 shots |

### Max Range (end of range)

| Weapon | Dmg/shot | vs Walker | vs Runner | vs Tank |
|---|---|---|---|---|
| **Pistol** @30 | 10 | 6 shots | 4 shots | 20 shots |
| **Rifle** @80 | 35 | 2 shots | 2 shots | 6 shots |
| **Uzi** @20 | 6 | 10 shots | 7 shots | 34 shots |
| **Shotgun** @12 | ~12 total | 5 shots | 4 shots | 17 shots |

---

## DPS Comparison (sustained, point blank, full magazine)

| Weapon | DPS | Mag Duration | Mag Total Dmg |
|---|---|---|---|
| **Pistol** | 66.7 | 3.3s (12 shots) | 240 |
| **Rifle** | 43.8 | 5.6s (8 shots) | 280 |
| **Uzi** | 100.0 | 2.9s (30 shots) | 300 |
| **Shotgun** | 48.0 | 5.0s (6 shots) | 288 |

---

## Damage Falloff Graph

```
Damage
  |
48|S.........
  |          '.
40|            '.
35|R============'============================R (rifle: flat 35 all the way)
  |              '.
30|                '.
  |
20|P.........        '.
  |  uzi     '.       '.
15|            'P       '.
  |  U.....     '.       '.
10|        'U     'P       'S
  |          'U     '.
 6|            U      'P
  |
 0+----+----+----+----+----+----+----+----+--> Distance
  0    5   10   15   20   25   30  ...   80

  P = Pistol    R = Rifle    U = Uzi    S = Shotgun (all 6 pellets)
```

---

## Laser Sight Visuals

| Stat | Pistol | Rifle | Uzi | Shotgun |
|---|---|---|---|---|
| Laser Length | 5 | 50 | 3.5 | 2.5 |
| Laser Color | Red | Green | Orange | Orange-Red |
| Cone Max Spread | 2 | 0.8 | 3 | 5 |
| Cone Min Spread | 0.04 | 0.02 | 0.08 | 0.3 |
| Focus Duration | 0.8s | 1.5s | 0.4s | 0.6s |

---

## Design Summary

- **Pistol** - Balanced all-rounder. Decent at every range, reliable fallback.
- **Rifle** - Slow, precise, long range. Best vs tanks at distance (always 6 shots). Low DPS but consistent.
- **Uzi** - Fast spray, short range. Highest sustained DPS (100) but range and falloff limit effectiveness past 10 units.
- **Shotgun** - Devastating up close (one-shots runners, 2-shots walkers). Falls off hard beyond 5 units. Wide pellet spread.
