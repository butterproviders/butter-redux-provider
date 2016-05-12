import configureMockStore from 'redux-mock-store'
import promise from 'redux-promise'
import expect from 'expect';
import ButterReduxProvider from '../../src';

const middlewares = [ promise ]
const mockStore = configureMockStore(middlewares)

describe('init', () => {
  it('inits the instance', () => {
    let instance = new ButterReduxProvider()

    const expectedActions = [
      { type: instance.types.FETCH },
    ]
    const store = mockStore({ items: [] })

    return store.dispatch(instance.actions.fetch())
      .then(() => { // return of async actions
        expect(store.getActions()).toEqual(expectedActions) 
      })
  })
})
