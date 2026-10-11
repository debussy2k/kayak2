import { createStore, combineReducers, Store, AnyAction } from 'redux'
import undoable, { ActionCreators, StateWithHistory } from 'redux-undo';
import { Record, Map } from 'immutable';

/*  
	no operation의 처리는 
*/

// Reducer Alpha
// Record는 아래처럼 사용할 key를 미리 정해 놓아야 한다.
// 참고: https://tonyhb.gitbooks.io/redux-without-profanity/content/using_immutablejs_records.html

// immutable 3.8 typings는 Record()를 함수로만 선언한다. 런타임은 new를 붙여도 같은 class를 돌려주므로 캐스팅만 한다.
const TPathState = new (Record as any)({
	align_to_path: 'none',
	flip_path: false,
	start_bracket: 0,
	end_bracket: 1
}) 

// noop_count는 연속된 noop이 별도의 명령으로 기록되도록 하기 위함.
const RootState = new (Record as any)({
	noop: false,
	noop_count: 0,
	tpath: new TPathState()
}) 

// immutable 3.8의 Record 인스턴스는 Map<string, any>로 선언돼 있어 state.noop_count 같은 getter를 타입이 모른다. any로 둔다.
function noop_reducer(state: any = new RootState(), action: AnyAction) {
	if (action.type == 'NOOP')
		return state.merge({noop:true, noop_count:state.noop_count+1})
	else
		return state;
}
function tpath_reducer(state: any = new RootState(), action: AnyAction) {
	switch (action.type) {
		case 'TPath.ALIGN':
			return state.setIn(['tpath', 'align_to_path'], action.align_to_path)
			break;
		case 'TPath.FLIP_PATH':
			return state.setIn(['tpath', 'flip_path'], action.flip_path)
			break;
		case 'TPath.START_BRACKET':
			return state.setIn(['tpath', 'start_bracket'], action.value)
			break;
		case 'TPath.END_BRACKET':
			return state.setIn(['tpath', 'end_bracket'], action.value)
			break;

		default:
			return state;
	}
}

class TB_History {
	store: Store<StateWithHistory<any>> | null;

	constructor() {
		this.store = null;
		
		this.setup();
	}

	rootReducer(state: any = new RootState(), action: AnyAction) {
		let new_state = state.withMutations((s: any) => {
			tpath_reducer(s, action);
			// next_reducer(s, action)
			// ...
		})
	
		// console.log('changed: ', new_state != state)
		if (new_state != state)
			return new_state.merge({noop:false, noop_count:new_state.noop_count+1})
		else
			return noop_reducer(new_state, action);
	}

	setup(): void {
		this.store = createStore(undoable(this.rootReducer))
		
		this.store.subscribe(() => {
			this.show_state()
		})
	}

	show_state(): void {
		let past = this.store!.getState().past;
		let present = this.store!.getState().present;
		let noop = present.noop;
		let tpath = present.tpath;
		// console.log(`[${past.length} ${present.noop}/${present.noop_count}]`, tpath.toString())
	}


	dispatch(obj: AnyAction): void {
		this.store!.dispatch(obj)
	}

	noop(): void {
        this.store!.dispatch({type: 'NOOP'})
	}

	undo(): void {
		this.store!.dispatch(ActionCreators.undo());
	}
	redo(): void {
		this.store!.dispatch(ActionCreators.redo());
	}
	reset(): void {
		this.store!.dispatch(ActionCreators.clearHistory());
	}

	get_state(): StateWithHistory<any> {
		return this.store!.getState()
	}
}


export { TB_History };
