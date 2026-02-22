# Weapon Balance Reference

All numbers match the code. 1 trigger pull = 1 ammo, regardless of pellet count.


## Zombie Health

    Zombie     HP     Speed   Damage   Attack CD   XP
    -------   -----   -----   ------   ---------   ---
    Walker       60     3.5       10       1.0s      10
    Runner       40     7.0        8       0.8s      15
    Tank        200     2.0       25       1.5s      30


## Weapon Stats

    Stat               Pistol       Rifle          Uzi          Shotgun
    -----------------  ----------   -----------    -----------  ---------------
    Damage             20           35 (x2)        10 (x4)      8 (x6)
    Dmg per pull       20           70             40           48
    Fire Rate (sec)    0.3          0.8            0.1          1.0
    Magazine           8            18             32           6
    Reload Time (sec)  1.5          2.5            1.8          2.2
    Projectile Speed   40           60             35           30
    Range              30           80             20           12
    Pellets            1            2              4            6
    Spread             0            0 (staggered)  0 (staggered)  0.35 rad
    Ammo per pull      1            2              4            1
    Hotkey             1            2              3            4


## Damage Falloff

Falloff is linear from falloffStart down to falloffMinMult at max range.

    Stat              Pistol   Rifle   Uzi   Shotgun
    ---------------   ------   -----   ---   -------
    Has Falloff       yes      NO      yes   yes
    Falloff Start     15       -       10    5
    Min Multiplier    0.5      1.0     0.6   0.3


## Damage at Distance

### Pistol (20 dmg x1, range 30, falloff 15-30, min 50%)

    Distance    0      7.5     15     22.5     30
    --------   ---    -----   ----   ------   ----
    Damage      20      20     20       15     10
    % of max   100%   100%   100%     75%     50%

### Rifle (35 dmg x2 staggered, range 80, NO falloff)

    Distance      0      20     40      60      80
    ----------   ---    ----   ----    ----    ----
    Per bullet    35      35     35      35      35
    Both hit      70      70     70      70      70
    % of max     100%   100%   100%   100%    100%

### Uzi (10 dmg x4 staggered, range 20, falloff 10-20, min 60%)

    Distance       0       5      10      15      20
    ----------   ----    ----    ----    ----    ----
    Per bullet     10      10      10       8       6
    All 4 hit      40      40      40      32      24
    % of max      100%   100%   100%     80%     60%

### Shotgun (8 dmg x6 spread, range 12, +50% within 5, falloff 5-12, min 30%)

    Distance      0     2.5      5     8.5     12
    ----------   ---    ----    ---    ----    ---
    Per pellet    12      12      8       4      2
    All 6 hit     72      72     48      24     12
    Bonus        +50%   +50%    --      --      --


## Shots to Kill (pulls to kill, 1 ammo per pull)

### Point Blank (distance = 0)

    Weapon                      vs Walker (60 HP)   vs Runner (40 HP)   vs Tank (200 HP)
    --------------------------  -----------------   -----------------   -----------------
    Pistol  (20/pull,  0.3s)    3 pulls (0.6s)      2 pulls (0.3s)     10 pulls (2.7s)
    Rifle   (70/pull,  0.8s)    1 pull  (0.0s)      1 pull  (0.0s)      3 pulls (1.6s)
    Uzi     (40/pull,  0.1s)    2 pulls (0.1s)      1 pull  (0.0s)      5 pulls (0.4s)
    Shotgun (72/pull,  1.0s)    1 pull  (0.0s)      1 pull  (0.0s)      3 pulls (2.0s)

### Mid Range (halfway through falloff zone)

    Weapon            Dmg/pull   vs Walker   vs Runner   vs Tank
    ----------------  --------   ---------   ---------   -------
    Pistol  @22.5     15          4 pulls     3 pulls    14 pulls
    Rifle   @40       70          1 pull      1 pull      3 pulls
    Uzi     @15       32          2 pulls     2 pulls     7 pulls
    Shotgun @8.5      ~24         3 pulls     2 pulls     9 pulls

### Max Range (end of range)

    Weapon            Dmg/pull   vs Walker   vs Runner   vs Tank
    ----------------  --------   ---------   ---------   --------
    Pistol  @30       10          6 pulls     4 pulls    20 pulls
    Rifle   @80       70          1 pull      1 pull      3 pulls
    Uzi     @20       24          3 pulls     2 pulls     9 pulls
    Shotgun @12       ~12         5 pulls     4 pulls    17 pulls


## DPS Comparison (sustained, point blank, full magazine)

    Weapon    DPS      Mag Duration        Mag Total Dmg
    ------   ------   -----------------   -------------
    Pistol     66.7   2.1s  (8 pulls)     160
    Rifle     87.5    6.4s  (9 pulls)     630
    Uzi      400.0    0.7s  (8 pulls)     320
    Shotgun   72.0    5.0s  (6 pulls)     432


## Damage Falloff Graph

```
Damage (per pull, all bullets hit)
  |
70|  R==============================================R (rifle: flat 70)
  |
48|S.........
  |          '.
40|U.........  '.
  |          '.  '.
35|            '.  '.
  |  uzi       '.  '.
32|    'U        '.  '.
  |      '.       '.  '.
24|        'U       '.  'S
20|P.........         '.
  |            '.       '.
15|              'P       '.
  |                '.
12|                  '.     'S
10|    'P
  |
 0+----+----+----+----+----+----+----+----+--> Distance
  0    5   10   15   20   25   30  ...   80

  P = Pistol (x1)   R = Rifle (x2)   U = Uzi (x4)   S = Shotgun (x6)
```


## Laser Sight Visuals

    Stat              Pistol   Rifle   Uzi      Shotgun
    ----------------  ------   -----   ------   ----------
    Laser Length       5       50       3.5      2.5
    Laser Color       Red     Green   Orange   Orange-Red
    Cone Max Spread    2        0.8     3        5
    Cone Min Spread    0.04     0.02    0.08     0.3
    Focus Duration     0.8s     1.5s    0.4s     0.6s


## Design Summary

    Pistol  - Balanced single-shot. 8 rounds, reliable at all ranges.
    Rifle   - Fires 2 bullets staggered per pull. 18 rounds, no falloff,
              devastating at any range. Slow fire rate balances the power.
    Uzi     - Fires 4 bullets staggered per pull. 32 rounds, fastest fire
              rate (0.1s). Highest DPS up close, falls off past 10 units.
    Shotgun - Fires 6 pellets in a spread per pull. 6 rounds, +50% bonus
              within 5 units (12 per pellet = 72 total, one-shots walkers
              and runners). Kills tank in 3 pulls. Harsh falloff past 5.
