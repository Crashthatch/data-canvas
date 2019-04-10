#To install for development:

```
git clone git@github.com:Crashthatch/data-canvas.git jupyter-canvas
cd jupyter-canvas 
npm install
cd ..

jupyter nbextension install ./jupyter-canvas --user --symlink
```
(for production, don't pass --symlink)

#To enable plugin:

```
jupyter nbextension enable jupyter-canvas/main
```

#Issues, features & bugs:

https://huboard.com/Crashthatch/data-canvas/#/
