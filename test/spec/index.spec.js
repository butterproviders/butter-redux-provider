import expect from 'expect'

import {createStore, applyMiddleware} from 'redux'
import thunk from 'redux-thunk'

import configureMockStore from 'redux-mock-store'
import ButterMockProvider from 'butter-mock-provider'

import reduxProviderAdapter, {SimpleCache} from '../../src'

const middlewares = [thunk]
const mockStore = configureMockStore(middlewares)

const debug = require('debug')('butter-redux-provider:test')

const actionKeys = ['FETCH', 'DETAIL', 'RANDOM', 'UPDATE']

describe('butter-redux-provider', () => {
  let MockProviderInstance

  beforeEach(() => {
    MockProviderInstance = new ButterMockProvider()
  })

  const checkReduxProvider = (Provider, name) => {
    const {
      provider, actionTypes, actions
    } = Provider

    expect(provider).toBeTruthy()

    actionKeys.forEach(key => expect(actionTypes).toHaveProperty(key))
    actionKeys.forEach(key => expect(actions).toHaveProperty(key))

    expect(provider.config.name).toEqual(name)
  }

  it('loads a provider by name', () => {
    checkReduxProvider(reduxProviderAdapter('vodo'), 'vodo')
  })

  it('loads a provider by instance', () => {
    checkReduxProvider(reduxProviderAdapter(ButterMockProvider), 'mock')
  })

  it('loads a provider by instanciated object', () => {
    checkReduxProvider(reduxProviderAdapter(MockProviderInstance), 'mock')
  })

  describe('actions', () => {
    let store
    let reduxProvider
    const mockProviderInstance = new ButterMockProvider()
    const cache = new SimpleCache()

    beforeEach(() => {
      reduxProvider = reduxProviderAdapter(mockProviderInstance, cache)
      store = mockStore({ids: {}})
    })

    it('fetches', (done) => {
      const promise = store.dispatch(reduxProvider.actions.FETCH())
      debug('fetch', store.getState())

      promise.then(() => { // return of async actions
        const actions = store.getActions()
        const lastAction = actions.pop()
        const {payload} = lastAction

        debug('got', payload)

        expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.FETCH}_COMPLETED`)
        expect(payload).toHaveProperty('hasMore')
        expect(payload).toHaveProperty('results')
        expect(payload.results.length).toEqual(99)
        done()
      })
    })

    it('details', (done) => {
      store.dispatch(reduxProvider.actions.DETAIL('42'))
        .then(() => { // return of async actions
          const actions = store.getActions()
          const lastAction = actions.pop()
          const {payload} = lastAction

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.DETAIL}_COMPLETED`)
          expect(payload).toEqual(mockProviderInstance.mockData['42'])

          done()
        })
    })

    it('randoms', (done) => {
      const hackPayload = {hack: true}

      store.dispatch(reduxProvider.actions.DETAIL('42', hackPayload))
        .then(() => store.dispatch(reduxProvider.actions.RANDOM()))
        .then(() => { // return of async actions
          const actions = store.getActions()
          let lastAction = actions.pop()

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.RANDOM}_COMPLETED`)

          lastAction = actions.pop()
          expect(lastAction.type).toEqual(reduxProvider.actionTypes.RANDOM)

          lastAction = actions.pop()
          const {payload} = lastAction

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.DETAIL}_COMPLETED`)
          expect(payload).toHaveProperty('id')
          expect(payload).toHaveProperty('title')
          done()
        })
    })
  })

  describe('reducer', () => {
    let mockProviderInstance
    let reduxProvider
    let store
    let cache

    beforeEach(() => {
      mockProviderInstance = new ButterMockProvider()
      cache = new SimpleCache()
      reduxProvider = reduxProviderAdapter(mockProviderInstance, cache)

      /*
         ;['fetch', 'detail', 'random'].map(method => {
         const cachedMethod = provider[method]
         provider[method] = function() {
         return cachedMethod.apply(instance, arguments)
         .then(ret => {

         return ret
         })
         }
         })
       */

      store = createStore(reduxProvider.reducer, applyMiddleware(...middlewares))
      store.subscribe(() => debug('DISPATCH', store.getState()))
    })

    it('fetches', (done) => {
      let state = store.getState()

      expect(state.isFetching).toEqual(false, 'isFetching before')
      expect(state.fetched).toEqual(false, 'fetched before')
      expect(state.lastUpdated).toEqual(null, 'lastUpdated before')
      expect(state.ids).toEqual({}, 'ids before')

      const promise = store.dispatch(reduxProvider.actions.FETCH())

      state = store.getState()

      debug('state after', state)

      expect(state.isFetching.type).toEqual(reduxProvider.actionTypes.FETCH, 'isFetching after')
      expect(state.fetched).toEqual(false, 'fetched after')
      expect(state.lastUpdated).toEqual(null, 'lastUpdated after')
      expect(state.ids).toEqual({}, 'ids after')

      promise.then(() => {
        state = store.getState()

        debug('state resolved', state)

        expect(state.isFetching).toEqual(false, 'isFetching resloved')
        expect(state.fetched).toEqual(true, 'fetched resolved')

        const {ids} = state

        expect(ids['0'].length).toEqual(99, 'got 99 items')
        expect(cache.keys()).toEqual(Array.from(Array(99)).map((e, i) => `${i}`), 'cache keys resolved')
        expect(cache.keys().length).toEqual(99, 'cache length resolved')
        done()
      }).catch(done)
    })

    it('details', (done) => {
      let state = store.getState()

      expect(state.isFetching).toEqual(false, 'isFetching before')
      expect(state.fetched).toEqual(false, 'fetched before')
      expect(state.lastUpdated).toEqual(null, 'lastUpdated before')
      expect(state.ids).toEqual({}, 'ids before')

      const promise = store.dispatch(reduxProvider.actions.DETAIL('42'))
      state = store.getState()

      debug('state after', state)

      expect(state.isFetching.type).toEqual(reduxProvider.actionTypes.DETAIL, 'isFetching after')
      expect(state.fetched).toEqual(false, 'fetched after')
      expect(state.lastUpdated).toEqual(null, 'lastUpdated after')
      expect(state.ids).toEqual({}, 'ids after')

      promise.then(() => { // return of async actions
        state = store.getState()

        expect(state.isFetching).toEqual(false, 'isFetching resolved')

        const item = cache.get(42)
        expect(state.detail).toEqual(42)
        expect(item).toBeTruthy()
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('synopsis')

        done()
      })
    })

    it('randoms', () => store.dispatch(reduxProvider.actions.DETAIL('42'))
      .then(() => store.dispatch(reduxProvider.actions.RANDOM()))
      .then((payload) => { // return of async actions
        expect(payload).toHaveProperty('id')
        expect(payload).toHaveProperty('title')
      }))

    it('update', () => store.dispatch(reduxProvider.actions.UPDATE())
      .then((payload) => { // return of async actions
        expect(payload.length).toEqual(99)
      }))

    it('update fail', () => store.dispatch(reduxProvider.actions.UPDATE(false))
      .then((payload) => { // return of async actions
        expect(payload).toEqual(null)
      }))
  })
})
