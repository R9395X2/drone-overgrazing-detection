文档文件解释：

ultralytics: 项目结构文件夹，里面保存着模型结构，在训练和检测时会调用（不用管）
best.pt: 为训练后得到的权重文件，在检测时会使用
count_final.py: 检测计数程序，将权重.pt文件和目标图片路径输入即可使用（只运行这个）
result：文件夹为结果保存文件夹，检测后的结果会保存在这里

templates: 串口运行所需要的html文件都在里面（最后运行需要其中的upload.html）
templates-upload.html: 定义上传图片界面的html
templates-display.html: 定义处理及显示界面的html

upload: 上传后保存上传图片的文件夹，用于接下来的处理，最终结果图也会保存在这里

web.pt: 串口运行的文件，其中包括网页运行的流程以及检测所用的方法，检测所用的.pt权重文件也在其中修改



运行流程：

普通检测方法：
1.在count_final.py的第8行确认权重文件路径是否正确
2.在count_final.py的第143行输入想要检测图片的绝对路径
3.直接运行count_final.py,运行结果在result文件夹中

串口网页检测方法：
1.在web.py的第10行看upload保存路径是否正确
2.在web.py的第13行看训练得到的.pt训练权重文件路径是否正确
3.在web.py的第67行是不是display.html
4.在web.py的第76、87行是不是display.html
5.运行web.py
6.到templates文件夹中点击upload.html，跳转至网页开始运行
7.上传图片
8.点击开始检测
9.到upload文件夹中查看结果图
