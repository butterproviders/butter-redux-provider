import configureMockStore from 'redux-mock-store'
import promise from 'redux-promise'
import expect from 'expect';
import ButterReduxProvider from '../../src';

const middlewares = [ promise ]
const mockStore = configureMockStore(middlewares)

describe('init', () => {
    it('loads a different provider depending on the \'name\' config value', () => {
        let instance = new ButterReduxProvider({name: 'ccc'})

        expect(instance).toExist()
        expect(instance.provider.config.name).toEqual('ccc')
    })

    describe('actions', () => {
        let instance, store

        beforeEach(() => {
            instance = new ButterReduxProvider()
            store = mockStore({ items: [] })
        })

        it('fetches', () => {
            return store.dispatch(instance.actions.fetch())
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(instance.types.FETCH)
                            expect(payload).toIncludeKey('hasMore')
                            expect(payload).toIncludeKey('results')
                            expect(payload.results.length).toExist()
                        })
        })

        it('details', () => {
            const hackPayload = {hack: true}
            return store.dispatch(instance.actions.detail('tt1152828', hackPayload))
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(instance.types.DETAIL)
                            expect(lastAction.payload).toEqual(hackPayload)
                        })
        })

        it('randoms', () => {
            return store.dispatch(instance.actions.random())
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(instance.types.RANDOM)
                            expect(lastAction).toEqual(instance.types.DETAIL)
                            expect(payload).toIncludeKey('hasMore')
                            expect(payload).toIncludeKey('results')
                            expect(payload.results.length).toExist()
                        })
        })

        it('ids', () => {
            const idField = instance.provider.config.uniqueId;
            const items = {results: [
                {[idField]: '1', data: 'blah'},
                {[idField]: '2', data: 'foo'},
                {[idField]: '3', data: 'bar'}
            ], hasMore: false}

            return store.dispatch(instance.actions.ids(items))
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(instance.types.IDS)
                            expect(payload).toEqual(['1', '2', '3']);
                        })
        })
    })
})
