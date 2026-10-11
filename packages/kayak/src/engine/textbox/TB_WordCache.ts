class TB_WordCache {
	map: Record<string, number>;

	constructor() {
		this.map = new Object() as Record<string, number>;
	}

	size(): number {
		var count = 0;
		for (var prop in this.map)
			count++;
		return count;
	}
	get(key: string): number | undefined {
		return this.map[key];
	}
	put(key: string, value: number): void {
		this.map[key] = value;
	}
	remove(key: string): void {
		delete this.map[key];
	}
	clear(): void {
		for(var prop in this.map)
			delete this.map[prop];
	}
	containsValue(value: number): boolean {
		for(var prop in this.map)
			if(this.map[prop] == value) return true;
		return false;
	}
}

export default TB_WordCache;
