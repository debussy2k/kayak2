import type GT_SegRange from './GT_SegRange';

/*
    텍스트(char code 배열)와 레이어 데이터(m_srv)를 들고 있는 전역 클립보드.
    GT_MasterClipboard.getInstance()로만 얻는다 (싱글턴). 호스트도 같은 방식으로 쓴다.
*/
export class MasterClipboard {
    m_text: number[] = [];
    m_srv: GT_SegRange[] = [];
    private _system_clipboard_has_content = false;

    clear_all(): void {
        this.m_srv.length = 0;
    }

    get_text(opt?: { single_line_mode?: boolean }): number[] {
        let text = this._conv_CRLF_to_LF(this.m_text);
        if (opt && opt.single_line_mode) {
            text = text.map(ch => {
                return (ch == 10) ? 32 : ch; // LF는 space로 치환함
            })
        }
        return text;
    }

    /*
        CR(13), LF(10) ==> LF(10) 으로 치환
    */
    _conv_CRLF_to_LF(text: number[]): number[] {
        let arr: number[] = []
        for(let i=0; i<text.length; i++) {
            if (i<text.length-1 && text[i] == 13 && text[i+1] == 10) {
                // skip CR(13) value
            }
            else
                arr.push(text[i])
        }
        return arr;
    }

    copy_text_data(text_data: number[]): void {
        this._system_clipboard_has_content = false;
        this.m_text = text_data.slice(0);
        this.m_srv.length = 0;
    }

    get_element_size(): number {
        return this.m_text.length;
    }

    copy_from_system_clipboard(): void {
        this.m_text = [];

        var str = '';

        // Lorem ipsum
        // str = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n';
        //str += 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

        // Crimea
        str += 'A peninsula with a population of 2 million that juts into the Black Sea, Crimea is dominated by ethnic Russians.\n';
        str += 'An autonomous republic within Ukraine, Crimea belonged to Russia until 1954 and is predominantly Russian-speaking.\n';
        str += 'Ukrainians account for about a quarter of the population.\n';
        str += 'As home to Russia’s Black Sea Fleet, it is geopolitically strategic for the Kremlin and has become the latest destination in Russia’s push for influence over former Soviet states.\n';

        this.m_text = [];
        for(var i=0; i<str.length; i++)
            this.m_text.push(str.charCodeAt(i));

        this._system_clipboard_has_content = true;
    }

    copy_from_string_data(string_data: string): void {
        this._system_clipboard_has_content = true;
        this.m_text = [];
        for(var i=0; i<string_data.length; i++)
            this.m_text.push(string_data.charCodeAt(i));
        this.m_srv.length = 0;
    }

    system_clipboard_has_content(): boolean {
        return this._system_clipboard_has_content;
    }
}

let instance: MasterClipboard | null = null;

const GT_MasterClipboard = {
    getInstance(): MasterClipboard {
        if (instance === null)
            instance = new MasterClipboard();
        return instance;
    }
};

export default GT_MasterClipboard;
