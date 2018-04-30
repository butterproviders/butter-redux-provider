import {createStore, applyMiddleware} from 'redux'
import promise from 'redux-promise'
import thunk from 'redux-thunk'

import configureMockStore from 'redux-mock-store'

import expect from 'expect';

import ButterProvider from 'butter-provider';
import ButterMockProvider from 'butter-mock-provider';

import ButterReduxProvider from '../../src';

const middlewares = [ thunk ]
const mockStore = configureMockStore(middlewares)

const debug = require('debug')('butter-redux-provider:test')

describe('butter-redux-provider', () => {
    let MockProviderInstance

    beforeEach(() => {
        MockProviderInstance = new ButterMockProvider()
    })

    it('loads a provider by name', () => {
        let instance = new ButterReduxProvider('vodo')

        expect(instance).toExist()
        expect(instance.config.name).toEqual('vodo')
    })

    it('loads a provider by instance', () => {
        let instance = new ButterReduxProvider(ButterMockProvider)

        expect(instance).toExist()
        expect(instance.config.name).toEqual('mock')
    })

    it('loads a provider by instanciated object', () => {
        let instance = new ButterReduxProvider(MockProviderInstance)

        expect(instance).toExist()
        expect(instance.config.name).toEqual('mock')
    })


    describe('actions', () => {
        let instance, store

        beforeEach(() => {
            instance = new ButterReduxProvider(MockProviderInstance)
            store = mockStore({ items: [] })
        })

        it('fetches', () => {
            let promise = store.dispatch(instance.actions.FETCH())
            debug('fetch', store.getState())

            return promise.then(() => { // return of async actions
                let actions = store.getActions()
                let lastAction = actions.pop()
                let payload = lastAction.payload

                debug('got', payload)

                expect(lastAction.type).toEqual(
                    instance.actionTypes.FETCH + '_COMPLETED')
                expect(payload).toIncludeKey('hasMore')
                expect(payload).toIncludeKey('results')
                expect(payload.results.length).toEqual(99)
            })
        })

        it('details', (done) => {
            store.dispatch(instance.actions.DETAIL('42'))
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(
                                instance.actionTypes.DETAIL  + '_COMPLETED')
                            expect(lastAction.payload).toEqual(instance.provider.mockData['42'])

                            done()
                        })
        })

        it('randoms', () => {
            const hackPayload = {hack: true}

            return store.dispatch(instance.actions.DETAIL('42', hackPayload))
                        .then(() => store.dispatch(instance.actions.RANDOM()))
                        .then(() => { // return of async actions
                            let actions = store.getActions()
                            let lastAction = actions.pop()
                            let payload = lastAction.payload

                            expect(lastAction.type).toEqual(
                                instance.actionTypes.RANDOM  + '_COMPLETED')

                            lastAction = actions.pop()
                            expect(lastAction.type).toEqual(
                                instance.actionTypes.RANDOM)

                            lastAction = actions.pop()
                            expect(lastAction.type).toEqual(
                                instance.actionTypes.DETAIL + '_COMPLETED')
                            expect(payload).toIncludeKey('id')
                            expect(payload).toIncludeKey('title')
                        })
        })
    })

    describe('reducer', () => {
        let instance, mockProviderInstance, store

        beforeEach(() => {
            mockProviderInstance = new ButterMockProvider()
            instance = new ButterReduxProvider(mockProviderInstance)
            /*          
               Array.from(['fetch', 'detail', 'random']).map(method => {
                const cachedMethod = instance.provider[method]
                instance.provider[method] = function() {
                    return cachedMethod.apply(instance, arguments)
                                .then(ret => {

                                    return ret
                                })
               }
               })
            */

            store = createStore(instance.reducer, applyMiddleware(...middlewares))
            store.subscribe(() => debug('DISPATCH', store.getState()))
        })

        it('fetches', (done) => {
            let state = store.getState()

            expect(state.isFetching).toEqual(false, 'isFetching before')
            expect(state.fetched).toEqual(false, 'fetched before')
            expect(state.lastUpdated).toEqual(null, 'lastUpdated before')
            expect(state.items).toEqual([], 'items before')

            let promise = store.dispatch(instance.actions.FETCH())

            state = store.getState()

            debug('state after', state)

            expect(state.isFetching).toEqual(instance.actionTypes.FETCH, 'isFetching after')
            expect(state.fetched).toEqual(false, 'fetched after')
            expect(state.lastUpdated).toEqual(null, 'lastUpdated after')
            expect(state.items).toEqual([], 'items after')

            return promise.then((result) => {
                state = store.getState()

                debug('state resolved', state, )

                expect(state.isFetching).toEqual(false, 'isFetching resloved')
                expect(state.fetched).toEqual(true, 'fetched resolved')

                let items = state.items

                expect(items.length).toEqual(99, 'items length resolved')
                expect(Object.keys(state.cache)).toEqual(
                    Array.from(Array(99)).map((e, i) => `${i}`), 'cache keys resolved'
                )
                expect(Object.keys(state.cache).length).toEqual(99, 'cache length resolved')
                done()
            })
        })

        it('details', (done) => {
            let state = store.getState()

            expect(state.isFetching).toEqual(false, 'isFetching before')
            expect(state.fetched).toEqual(false, 'fetched before')
            expect(state.lastUpdated).toEqual(null, 'lastUpdated before')
            expect(state.items).toEqual([], 'items before')

            let promise = store.dispatch(instance.actions.DETAIL('42'))
            state = store.getState()

            debug('state after', state)

            expect(state.isFetching).toEqual(instance.actionTypes.DETAIL, 'isFetching after')
            expect(state.fetched).toEqual(false, 'fetched after')
            expect(state.lastUpdated).toEqual(null, 'lastUpdated after')
            expect(state.items).toEqual([], 'items after')

            promise.then(() => { // return of async actions
                state = store.getState()

                expect(state.isFetching).toEqual(false, 'isFetching resolved')
                expect(state.fetched).toEqual(true, 'fetched resolved')
                expect(state.detail).toEqual(42)
                expect(state.cache[42]).toExist()
                expect(state.cache[42]).toIncludeKey('id')
                expect(state.cache[42]).toIncludeKey('synopsis')

                done()
            })
        })

        it('randoms', () => {
            return store.dispatch(instance.actions.DETAIL('42'))
                        .then(() => store.dispatch(instance.actions.RANDOM()))
                        .then((payload) => { // return of async actions
                            expect(payload).toIncludeKey('id')
                            expect(payload).toIncludeKey('title')
                        })
        })

        it('update', () => {
            return store.dispatch(instance.actions.UPDATE())
                        .then((payload) => { // return of async actions
                            expect(payload.length).toEqual(99)
                        })
        })

        it('update fail', () => {
            return store.dispatch(instance.actions.UPDATE(false))
                        .then((payload) => { // return of async actions
                            expect(payload).toEqual(null)
                        })
        })

    })
})
