/*
    html의 dimesion을 측정하기 위해 유일하게 생성되는 div element를 이용한다.
*/
import _g from './TB_PlatformEnv';

// Singleton
class MeasureObject {
    metric_box: HTMLDivElement;

    constructor() {
        // ##original
        // this.lDiv = document.createElement('lDiv');
        // document.body.appendChild(this.lDiv); // document ready된 상태에서 유효.
        // this.lDiv.style.position = "fixed";
        // this.lDiv.style.left = "-1000px";
        // this.lDiv.style.top = "-1000px";

        /////
        var metric_box = _g.document!.createElement('div');
        metric_box.setAttribute('id', 'kayak_metric_box');
        _g.document!.body.appendChild(metric_box);

        this.metric_box = metric_box;
    }

    show(bShow: boolean) {
        if (bShow) {
            this.metric_box.style.top = '100px';
            this.metric_box.style.left = '10px';
        } else {
            this.metric_box.style.top = '-1000px';
            this.metric_box.style.left = '10px';
        }
    }
}

var Instance: MeasureObject | null = null;
var MeasureDiv = {
    Instance: function(): MeasureObject {
        if (Instance === null)
            Instance = new MeasureObject;
        return Instance;
    }
};


export default MeasureDiv;
