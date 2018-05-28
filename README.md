butter-redux-provider
===

transform a provider into reducers and actions to use with a redux store

basic usage
=== 

just pass a provider, that you have initialized and get back actions
```js
    import reduxProviderAdapter from 'butter-redux-provider'
    import {createStore} frome 'redux'

    const Provider = require('butter-provider-fancystuff')
    const instance = new Provider('fancystuff?getPonies=true')

    const {actions, reducer} = reduxProviderAdapter(instance)

    const store = createStore(reducer)
    store.dispatch(actions.FETCH)
```

cache
===

to make this actually usefull you need to pass it a cache object that
accepts `get` and `set` methods, we provide a very dumb `SimpleCache` module
to do just that

```js
    import reduxProviderAdapter, {SimpleCache} from 'butter-redux-provider'
    import {createStore, combineReducers} frome 'redux'

    const cache = new SimpleCache()
    const Provider = require('butter-provider-fancystuff')
    const instance = new Provider('fancystuff?getPonies=true')

    const {actions, reducer} = reduxProviderAdapter(instance, cache)

    const store = createStore(combineReducers({
        collection: reducer,
        cache: () => (cache)
    }))
    store.dispatch(actions.FETCH)
    // collection now receives ids, and cache ids => object mappings
```

