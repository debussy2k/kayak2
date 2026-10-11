const EmptyRangeRule = {
    DEFAULT : 'default',
    SELECT_ALL : 'select_all'
} as const;

class TextBoxEnv {
	empty_range_rule: string;

	constructor(tb: unknown) {
        this.empty_range_rule = EmptyRangeRule.SELECT_ALL
    }
}

export { TextBoxEnv, EmptyRangeRule };
