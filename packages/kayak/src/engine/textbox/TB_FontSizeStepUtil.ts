import sortedIndex from 'lodash/sortedIndex';

class TB_FontSizeStepUtil {
    font_size_steps: number[];

    constructor() {
        this.font_size_steps = [];

        this.fill_font_size_step();
    }

    lower_font_size(fsize: number): number {
        let index = sortedIndex(this.font_size_steps, fsize) - 1
        if (index < 0)
            index = 0;
        return this.font_size_steps[index];
    }
    upper_font_size(fsize: number): number {
        let index = sortedIndex(this.font_size_steps, fsize)
        if (this.font_size_steps[index] == fsize)
            index += 1;
        
        if (index >= this.font_size_steps.length)
            index = this.font_size_steps.length - 1;

        return this.font_size_steps[index];
    }

    fill_font_size_step(): void {
        for(var val=2; val<9; val += 0.5)
            this.font_size_steps.push(val);
        for(var val=9; val<12; val += 1)
            this.font_size_steps.push(val);
        for(var val=12; val<48; val += 2)
            this.font_size_steps.push(val);
        for(var val=48; val<100; val += 4)
            this.font_size_steps.push(val);
        for(var val=100; val<1000; val += 10)
            this.font_size_steps.push(val);
    }    
}

export {
    TB_FontSizeStepUtil
};