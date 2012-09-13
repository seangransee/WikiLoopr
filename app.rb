require 'sinatra'
require 'coffee-script'
require 'sass'
require 'json'

before do
  @lang = request.host.split('.')[0]
  if @lang == 'localhost' or @lang == 'wikiloopr' or @lang == 'www'
    @lang = 'en'
  end
  @copy = JSON.parse(File.read("copy.json"))
end

get '/' do
  @query = nil
  chosen_line = nil
  File.foreach("startlists/"+@lang+".startlist.txt").each_with_index do |line, number|
    chosen_line = line if rand < 1.0/(number+1)
  end
  @start = chosen_line
  haml :index
end

get '/wikiloopr.js' do
  coffee :wikiloopr
end

get '/styles.css' do
  sass :styles
end

get '/:query' do
  @query = params[:query]
  @start = ""
  haml :index
end