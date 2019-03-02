const ClasyncEmitter = require('clasync/emitter');

class Cmd extends ClasyncEmitter {
	async init() {
		const hub = Object.getPrototypeOf(this);

		for (const desc of Object.getOwnPropertyNames(hub)) {
			const [, levelName, mod, cmdName, cmdArgs, info] = desc.match(this.$.rxCmdDesc) || [];
			if (!cmdName) continue;

			const level = this.admin.$.levels[levelName.toLowerCase()];
			if (level == null) throw new Error(`Unknown level for: ${this.constructor.name} / ${desc}`);
			const cmd = cmdName.toLowerCase();

			const cmdObj = {
				level,
				context: this,
				handler: hub[desc],
				args: cmdArgs,
				info,
				index: `${this.admin.norm(cmd)}:${this.admin.norm(info)}`
			};

			this.admin.cmds[cmd] = cmdObj;
			if (mod) this.admin.modCmds[cmd] = cmdObj;
		}
	}
}

Cmd.rxCmdDesc = /^(\w+)(\+)?\s+(\w+)\s+([^:]*):\s*([\S\s]+)$/;

module.exports = Cmd;
