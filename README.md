#To install for development:

git clone git@github.com:Crashthatch/data-canvas.git 

jupyter nbextension install ./data-canvas --user --symlink

(for production, don't pass --symlink)

#To enable plugin:

jupyter nbextension enable data-canvas/main