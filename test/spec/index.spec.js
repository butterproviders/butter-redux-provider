import expect from 'expect';

import {createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk';

import configureMockStore from 'redux-mock-store';
import ButterMockProvider from 'butter-mock-provider';

import reduxProviderAdapter from '../../src';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const debug = require('debug')('butter-redux-provider:test');

const actionKeys = ['FETCH', 'DETAIL', 'RANDOM', 'UPDATE'];

describe('butter-redux-provider', () => {
  let MockProviderInstance;

  beforeEach(() => {
    MockProviderInstance = new ButterMockProvider();
  });

  const checkReduxProvider = (Provider, name) => {
    const {
      provider, actionTypes, actions
    } = Provider;

    expect(provider).toBeTruthy();

    actionKeys.forEach(key => expect(actionTypes).toHaveProperty(key));
    actionKeys.forEach(key => expect(actions).toHaveProperty(key));

    expect(provider.config.name).toEqual(name);
  };

  it('loads a provider by name', () => {
    checkReduxProvider(reduxProviderAdapter('vodo'), 'vodo');
  });

  it('loads a provider by instance', () => {
    checkReduxProvider(reduxProviderAdapter(ButterMockProvider), 'mock');
  });

  it('loads a provider by instanciated object', () => {
    checkReduxProvider(reduxProviderAdapter(MockProviderInstance), 'mock');
  });

  describe('actions', () => {
    let store;
    let reduxProvider;
    const mockProviderInstance = new ButterMockProvider();

    beforeEach(() => {
      reduxProvider = reduxProviderAdapter(mockProviderInstance);
      store = mockStore({items: []});
    });

    it('fetches', () => {
      const promise = store.dispatch(reduxProvider.actions.FETCH());
      debug('fetch', store.getState());

      return promise.then(() => { // return of async actions
        const actions = store.getActions();
        const lastAction = actions.pop();
        const {payload} = lastAction;

        debug('got', payload);

        expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.FETCH}_COMPLETED`);
        expect(payload).toHaveProperty('hasMore');
        expect(payload).toHaveProperty('results');
        expect(payload.results.length).toEqual(99);
      });
    });

    it('details', (done) => {
      store.dispatch(reduxProvider.actions.DETAIL('42'))
        .then(() => { // return of async actions
          const actions = store.getActions();
          const lastAction = actions.pop();
          const {payload} = lastAction;

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.DETAIL}_COMPLETED`);
          expect(payload).toEqual(mockProviderInstance.mockData['42']);

          done();
        });
    });

    it('randoms', () => {
      const hackPayload = {hack: true};

      return store.dispatch(reduxProvider.actions.DETAIL('42', hackPayload))
        .then(() => store.dispatch(reduxProvider.actions.RANDOM()))
        .then(() => { // return of async actions
          const actions = store.getActions();
          let lastAction = actions.pop();

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.RANDOM}_COMPLETED`);

          lastAction = actions.pop();
          expect(lastAction.type).toEqual(reduxProvider.actionTypes.RANDOM);

          lastAction = actions.pop();
          const {payload} = lastAction;

          expect(lastAction.type).toEqual(`${reduxProvider.actionTypes.DETAIL}_COMPLETED`);
          expect(payload).toHaveProperty('id');
          expect(payload).toHaveProperty('title');
        });
    });
  });

  describe('reducer', () => {
    let mockProviderInstance;
    let reduxProvider;
    let store;

    beforeEach(() => {
      mockProviderInstance = new ButterMockProvider();
      reduxProvider = reduxProviderAdapter(mockProviderInstance);

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

      store = createStore(reduxProvider.reducer, applyMiddleware(...middlewares));
      store.subscribe(() => debug('DISPATCH', store.getState()));
    });

    it('fetches', (done) => {
      let state = store.getState();

      expect(state.isFetching).toEqual(false, 'isFetching before');
      expect(state.fetched).toEqual(false, 'fetched before');
      expect(state.lastUpdated).toEqual(null, 'lastUpdated before');
      expect(state.items).toEqual([], 'items before');

      const promise = store.dispatch(reduxProvider.actions.FETCH());

      state = store.getState();

      debug('state after', state);

      expect(state.isFetching).toEqual(reduxProvider.actionTypes.FETCH, 'isFetching after');
      expect(state.fetched).toEqual(false, 'fetched after');
      expect(state.lastUpdated).toEqual(null, 'lastUpdated after');
      expect(state.items).toEqual([], 'items after');

      promise.then(() => {
        state = store.getState();

        debug('state resolved', state);

        expect(state.isFetching).toEqual(false, 'isFetching resloved');
        expect(state.fetched).toEqual(true, 'fetched resolved');

        const {items} = state;

        expect(items.length).toEqual(99, 'items length resolved');
        expect(Object.keys(state.cache)).toEqual(Array.from(Array(99)).map((e, i) => `${i}`), 'cache keys resolved');
        expect(Object.keys(state.cache).length).toEqual(99, 'cache length resolved');
        done();
      });
    });

    it('details', (done) => {
      let state = store.getState();

      expect(state.isFetching).toEqual(false, 'isFetching before');
      expect(state.fetched).toEqual(false, 'fetched before');
      expect(state.lastUpdated).toEqual(null, 'lastUpdated before');
      expect(state.items).toEqual([], 'items before');

      const promise = store.dispatch(reduxProvider.actions.DETAIL('42'));
      state = store.getState();

      debug('state after', state);

      expect(state.isFetching).toEqual(reduxProvider.actionTypes.DETAIL, 'isFetching after');
      expect(state.fetched).toEqual(false, 'fetched after');
      expect(state.lastUpdated).toEqual(null, 'lastUpdated after');
      expect(state.items).toEqual([], 'items after');

      promise.then(() => { // return of async actions
        state = store.getState();

        expect(state.isFetching).toEqual(false, 'isFetching resolved');

        expect(state.detail).toEqual(42);
        expect(state.cache[42]).toBeTruthy();
        expect(state.cache[42]).toHaveProperty('id');
        expect(state.cache[42]).toHaveProperty('synopsis');

        done();
      });
    });

    it('randoms', () => store.dispatch(reduxProvider.actions.DETAIL('42'))
      .then(() => store.dispatch(reduxProvider.actions.RANDOM()))
      .then((payload) => { // return of async actions
        expect(payload).toHaveProperty('id');
        expect(payload).toHaveProperty('title');
      }));

    it('update', () => store.dispatch(reduxProvider.actions.UPDATE())
      .then((payload) => { // return of async actions
        expect(payload.length).toEqual(99);
      }));

    it('update fail', () => store.dispatch(reduxProvider.actions.UPDATE(false))
      .then((payload) => { // return of async actions
        expect(payload).toEqual(null);
      }));
  });
});
