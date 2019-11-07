const Cmd = require('./cmd');

class Inv extends Cmd {
  async init(deps) {
    await deps({      
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$mod', '$players')
    });

    const onGear = this.onGear.bind(this);

    this.sv.on('clcmd', this.onPreDrop.bind(this), true);
    this.$qvm.on('info', onGear);
    this.$qvm.on('item', onGear);
    this.$qvm.on('spawn', onGear);
  }

  getSfx(s) {
    const sfx = s.match(this.$.rxSfx);
    return sfx;
  }

  listNames(where, filter) {
    const names = [];

    for (const id in where) {
      const sfx = this.getSfx(id);
      if (!filter || sfx.indexOf(filter) >= 0) names.push(sfx);
    }

    return names;
  }

  findByName(where, name) {
    const lower = (name || '').toString().toLowerCase();

    for (const id in where) {
      const [sfx] = id.match(this.$.rxFindSfx) || [];
      if (lower === sfx) return where[id];
    }

    throw `^1Error ^5${name}^3 not found`;
  }

  decodeWeapon(n) {
    const info = {
      weapon: (n) & 0xff,
      ammo: (n >> 8) & 0xff,
      mode: (n >> 16) & 0xff,
      clips: (n >> 24) & 0xff
    };

    return info;
  }

  encodeWeapon(info) {
    const n = (
      (info.weapon) +
      (info.ammo << 8) +
      (info.mode << 16) +
      (info.clips << 24)
    );

    return n;
  }

  parseEntities(where, str) {
    if (!str) return null;
    const ents = str.toString().split(' ');

    const res = [];

    for (const ent of ents) {
      const parts = ent.match(this.$.rxParses);
      let n = 0;

      for (const part of parts) {
        const [, pfx, v] = part.match(this.$.rxParse) || [];

        switch (pfx) {
          case '+': n |= v << 8; break;
          case '@': n |= v << 16; break;
          case '*': n |= v << 24; break;
          case '': n |= this.findByName(where, v); break;
        }
      }

      res.push(n);
    }

    if (!res.length) return null;

    if (res.length > 16) res.length = 16;
    else while (res.length < 16) res.push(0);

    return res;
  }

  diffEntities(where, cur, str) {
    const [, diff, entstr] = str.match(this.$.rxDiff) || [];
    if (!entstr) return cur;

    const news = this.parseEntities(where, entstr);
    if (!diff) return news.join(' ');

    const ents = cur.split(' ');
    const result = ents.join(' ');
    return result;
  }

  decodeItem(n) {
    const info = {
      item: (n) & 0xff,
      active: (n >> 8) & 0xff
    };

    return info;
  }

  encodeItem(info) {
    const n = (
      (info.item) +
      (info.active << 8)
    );

    return n;
  }

  async checkInv({client, invForce}) {
    const {$players, $mod} = this;
    const player = $players.clients[client];
    const fields = invForce || this.$.force;

    const forceWeapons = (
      this.$.get(player, 'sets', 'inv', fields.forceWeapons) ||
      this.$.get($mod, 'sets', 'inv', fields.forceWeapons)
    );

    const forceItems = (
      this.$.get(player, 'sets', 'inv', fields.forceItems) ||
      this.$.get($mod, 'sets', 'inv', fields.forceItems)
    );

    return {forceWeapons, forceItems};
  }

  async setInv({client, forceWeapons, forceItems}) {
    const args = [];
    if (forceWeapons) args.push(` weapons ${forceWeapons} weapon 0 0`);
    if (forceItems) args.push(` items ${forceItems}`);
    if (args.length) this.urt4.cmd(`sv ps ${client}${args}`);
  }

  gearCheck(force, is) {
    if (!force) return true;
    const ws = force.split(' ');
    const matches = is.map(w => w & 0xFF).filter((w, i) => w === (ws[i] & 0xFF));
    return matches.length === is.length;
  }

  async onGear(args) {
    const {$players} = this;
    const player = $players.clients[args.client];
    if (!player) return false;

    const cfg = await this.checkInv(args);

    if (args.item) {
      const isWeapon = this.$.weapons[args.item];

      if (
        (isWeapon && !cfg.forceWeapons) ||
        (!isWeapon && !cfg.forceItems)
      ) {
        return false;
      }
    }

    if (args.info) {
      const state = await $players.getPlayerState(player);

      if (
        this.gearCheck(cfg.forceWeapons, state.weapons) &&
        this.gearCheck(cfg.forceItems, state.items)
      ) {
        return false;
      }
    }

    await this.setInv({...args, ...cfg});
    return false;
  }

  async onPreDrop(args) {
    const {cmd} = args;
    const weapDrop = this.$.rxWeapDrop.test(cmd);
    const itemDrop = this.$.rxItemDrop.test(cmd);
    if (!weapDrop && !itemDrop) return 0;
    const cfg = await this.checkInv(args);
    if (weapDrop) delete cfg.forceItems; else delete cfg.forceWeapons;
    if (!cfg.forceWeapons && !cfg.forceItems) return 0;
    //await this.setInv({...args, ...cfg});  // regain weapons on drop?
    return 1;
  }

  getGear(w) {
    const s = w.toLowerCase().split(/\W+/);
    const r = {};

    for (const i of s) {
      const c = this.findByName(this.$.itemGears, i).split('');
      for (const d of c) r[d] = true;
    }

    const gear = Object.keys(r).join('');
    return gear;
  }

  showGear(gear) {
    const ents = gear.split('');
    const names = [];

    for (const ent of ents) {
      const name = this.getSfx(this.$.itemGearNames[ent] || 'unknown');
      names.push(name);
    }

    return names.join(' ');
  }

  // CMD

  async ['MOD+ disallow <items...>: List of weapons/items that are disallowed'](
    {as, blames, args: [...weapons]}
  ) {
    const {$players} = this;
    const w = weapons.join(' ');

    if (!w) {
      const gear = await this.urt4.rpc(`com getcvar g_gear`);

      return [
        `^2Disallowed ^3weapons/items: ^5${this.showGear(gear)}`,
        '---',
        `^2All weapons and items:`,
        ...this.$.chunk(this.listNames(this.$.itemGears), 5).map(line => line.join(' '))
      ];
    }

    {
      const gear = this.getGear(w);
      this.urt4.cmd(`com cvar 1 g_gear ${gear}`);
      $players.chat(null, `^2Disallowed ^3weapons/items: ^5${this.showGear(gear)}`);
    }

    blames.push(null);
  }

  async ['MOD+ weapons <player|"$all"> <weapon+bullets*clips@mode ...> [<reason>]: Force player weapons. F.x. hk69+3*5@1 -- give HK69 with 3 nades and 5 reloadable clips mode 1 (long range)']({as, blames, args: [player, ...values]}) {
    const {$players, $mod} = this;

    if (!player) {
      return [
        `^2Avaliable weapons to force:`,
        ...this.$.chunk(this.listNames(this.$.weapons), 5).map(line => line.join(' '))
      ];
    }

    const value = values.join(' ').toLowerCase();

    blames.push(null);
  
    if (player === '$all') {
      if (!value || value === 'all') {
        this.$.set($mod, 'sets', 'inv', 'forceWeapons', '');
        $players.chat(null, `^2All^3 weapons allowed!`);
        return 0;
      }

      const state = await $players.getPlayerState(as);
      const weapons = this.diffEntities(this.$.weapons, state.weapons.join(' '), value);
      this.$.set($mod, 'sets', 'inv', 'forceWeapons', weapons);
      await this.$.all(Object.keys($players.clients).map(client => this.onGear({client})));
      $players.chat(null, `^3Allowed weapons are: ^1${value}^3`);
      return 0;
    }

    const p = $players.find(player, as);
    if (p.client < 0) return '^1Error ^5You\'re not a player';

    if (!value || value === 'all') {
      $players.set(p, {'sets.inv.forceWeapons': ''});
      $players.chat(null, `${$players.name(p)} have been allowed to use ^2all^3 weapons!`);
      return 0;
    }

    const state = await $players.getPlayerState(p);
    const weapons = this.diffEntities(this.$.weapons, state.weapons.join(' '), value);
    $players.set(p, {'sets.inv.forceWeapons': weapons});
    await this.onGear({client: p.client});
    $players.chat(null, `${$players.name(p)} have been allowed to use ^1${value}^3 weapons!`); 
    return 0;
  }


  async ['SUP+ items <player|"$all"> <items ...>: Force player items']({as, blames, args: [player, ...values]}) {
    const {$players, $mod} = this;

    if (!player) {
      return [
        `^2Avaliable items to force:`,
        ...this.$.chunk(this.listNames(this.$.items), 5).map(line => line.join(' '))
      ];
    }

    const value = values.join(' ').toLowerCase();

    blames.push(null);

    if (player === '$all') {
      if (!value || value === 'all') {
        this.$.set($mod, 'sets', 'inv', 'forceItems', '');
        $players.chat(null, `^2All^3 items allowed!`);
        return 0;
      }

      const state = await $players.getPlayerState(as);
      const items = this.diffEntities(this.$.items, state.items.join(' '), value);
      this.$.set($mod, 'sets', 'inv', 'forceItems', items);
      await this.$.all(Object.keys($players.clients).map(client => this.onGear({client})));
      $players.chat(null, `^3Allowed items are: ^1${value}^3`);
      return 0;
    }

    const p = $players.find(player, as);
    if (p.client < 0) return '^1Error ^5You\'re not a player';

    if (!value || value === 'all') {
      $players.set(p, {'sets.inv.forceItems': ''});
      $players.chat(null, `${$players.name(p)} have been allowed to use ^2all^3 items!`);
      return 0;
    }

    const state = await $players.getPlayerState(p);
    const items = this.diffEntities(this.$.items, state.items.join(' '), value);
    $players.set(p, {'sets.inv.forceItems': items});
    await this.onGear({client: p.client});
    $players.chat(null, `${$players.name(p)} have been allowed to use ^1${value}^3 items!`); 
    return 0;
  }
}

Inv.weapons = { // ut_weapon_...
  all: null,
  none: 0,
  ut_weapon_knife: 1,
  ut_weapon_beretta: 2,
  ut_weapon_deagle: 3,
  ut_weapon_spas12: 4,
  ut_weapon_mp5k: 5,
  ut_weapon_ump45: 6,
  ut_weapon_hk69: 7,
  ut_weapon_lr: 8,
  ut_weapon_g36: 9,
  ut_weapon_psg1: 10,
  ut_weapon_grenade_he: 11,
  ut_weapon_grenade_flash: 12,
  ut_weapon_grenade_smoke: 13,
  ut_weapon_sr8: 14,
  ut_weapon_ak103: 15,
  ut_weapon_bomb: 16,
  ut_weapon_negev: 17,
  ut_weapon_grenade_frag: 18, // don't set ammo, attempt to throw will crash the server
  ut_weapon_m4: 19,
  ut_weapon_glock: 20,
  ut_weapon_colt1911: 21,
  ut_weapon_mac11: 22,
  ut_weapon_frf1: 23,
  ut_weapon_benelli: 24,
  ut_weapon_p90: 25,
  ut_weapon_magnum: 26,
  ut_weapon_tod50: 27 // instagib
};

Inv.weaponNames = Inv.invert(Inv.weapons);

Inv.itemGears = {
  all: '',
  none: 'FGHIJKLMNZacefghijklOQRSTUVWX',
  ut_weapon_beretta: 'F',
  ut_weapon_deagle: 'G',
  ut_weapon_spas12: 'H',
  ut_weapon_mp5k: 'I',
  ut_weapon_ump45: 'J',
  ut_weapon_hk69: 'K',
  ut_weapon_lr: 'L',
  ut_weapon_g36: 'M',
  ut_weapon_psg1: 'N',
  ut_weapon_grenade_he: 'O',
  ut_weapon_grenade_smoke: 'Q',
  ut_item_vest: 'R',
  ut_item_nvg: 'S',
  ut_item_medkit: 'T',
  ut_item_silencer: 'U',
  ut_item_laser: 'V',
  ut_item_helmet: 'W',
  ut_item_extraammo: 'X',
  ut_weapon_sr8: 'Z',
  ut_weapon_ak103: 'a',
  ut_weapon_negev: 'c',
  ut_weapon_m4: 'e',
  ut_weapon_glock: 'f',
  ut_weapon_colt1911: 'g',
  ut_weapon_mac11: 'h',
  ut_weapon_frf1: 'i',
  ut_weapon_benelli: 'j',
  ut_weapon_p90: 'k',
  ut_weapon_magnum: 'l'
};

Inv.itemGearNames = Inv.invert(Inv.itemGears);

Inv.items = { // ut_item_...
  all: null,
  none: 0,
  team_CTF_redflag: 1,
  team_CTF_blueflag: 2,
  team_CTF_neutralflag: 3, // neutral flag
  ut_weapon_knife: 4,
  ut_weapon_beretta: 5,
  ut_weapon_deagle: 6,
  ut_weapon_spas12: 7,
  ut_weapon_mp5k: 8,
  ut_weapon_ump45: 9,
  ut_weapon_hk69: 10,
  ut_weapon_lr: 11,
  ut_weapon_g36: 12,
  ut_weapon_psg1: 13,
  ut_weapon_grenade_he: 14,
  ut_weapon_grenade_flash: 15,
  ut_weapon_grenade_smoke: 16,
  ut_item_vest: 17,
  ut_item_nvg: 18,
  ut_item_medkit: 19,
  ut_item_silencer: 20,
  ut_item_laser: 21,
  ut_item_helmet: 22,
  ut_item_extraammo: 23,
  ut_item_apr: 24, // exploding monkey
  ut_weapon_sr8: 25,
  ut_weapon_ak103: 26,
  ut_weapon_bomb: 27,
  ut_weapon_negev: 28,
  ut_weapon_grenade_frag: 29, // don't set ammo, attempt to throw will crash the server
  ut_weapon_m4: 30,
  ut_weapon_glock: 31,
  ut_weapon_colt1911: 32,
  ut_weapon_mac11: 33,
  ut_weapon_frf1: 34,
  ut_weapon_benelli: 35,
  ut_weapon_p90: 36,
  ut_weapon_magnum: 37,
  ut_weapon_tod50: 38 // instagib
};

Inv.force = {forceWeapons: 'forceWeapons', forceItems: 'forceItems'};
Inv.spawn = {forceWeapons: 'spawnWeapons', forceItems: 'spawnItems'};
Inv.itemNames = Inv.invert(Inv.items);
Inv.rxDiff = /^([+-]?)(.*)$/;
Inv.rxFindSfx = /[\da-z]+$/;
Inv.rxItemDrop = /^ut_itemdrop (\w+)/;
Inv.rxParses = /([+*@]?)(\w+)/g;
Inv.rxParse = new RegExp(Inv.rxParses.source);
Inv.rxSfx = /[\da-z]+$/;
Inv.rxWeapDrop = /^ut_weapdrop (\w+)/;

module.exports = Inv;
